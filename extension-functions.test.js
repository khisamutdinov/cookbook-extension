// extension-functions.test.js
import {
  extractPageContent,
  processContent,
  showResult,
  showError,
  formatJson,
  compressHtml
} from './extension-functions.js';

// Mock the chrome API
global.chrome = {
  runtime: {
    id: 'test-extension-id',
    sendMessage: jest.fn()
  },
  scripting: {
    executeScript: jest.fn()
  },
  tabs: {
    query: jest.fn()
  }
};

// Mock DOM elements and functions
document.getElementById = jest.fn().mockImplementation((id) => {
  return {
    style: { display: 'none' },
    textContent: '',
    innerHTML: '',
    appendChild: jest.fn()
  };
});

// Mock document.createTextNode
document.createTextNode = jest.fn().mockImplementation((text) => {
  return { text };
});

// Mock document.createElement
document.createElement = jest.fn().mockImplementation((tag) => {
  return {
    className: '',
    textContent: '',
    appendChild: jest.fn(),
    style: {},
    result: '',
    onloadend: null,
    onerror: null,
    readAsDataURL: jest.fn(function() {
      this.result = 'data:application/octet-stream;base64,dGVzdA==';
      this.onloadend();
    })
  };
});

// Mock Blob
global.Blob = jest.fn().mockImplementation(() => ({
  stream: () => ({
    pipeThrough: () => 'mock-stream'
  })
}));

// Mock Response
global.Response = jest.fn().mockImplementation(() => ({
  blob: async () => 'mock-blob'
}));

// Mock TextEncoder
global.TextEncoder = jest.fn().mockImplementation(() => ({
  encode: jest.fn().mockReturnValue(new Uint8Array([116, 101, 115, 116]))
}));

// Mock CompressionStream
global.CompressionStream = jest.fn().mockImplementation(() => 'mock-compression-stream');

// Mock FileReader
global.FileReader = jest.fn().mockImplementation(() => {
  return {
    result: 'data:application/octet-stream;base64,dGVzdA==',
    onloadend: null,
    onerror: null,
    readAsDataURL: jest.fn(function() {
      setTimeout(() => {
        this.onloadend && this.onloadend();
      }, 0);
    })
  };
});

describe('extractPageContent', () => {
  beforeEach(() => {
    // Create a simple DOM structure for testing
    document.body.innerHTML = `
      <html>
        <head>
          <script>console.log('test');</script>
          <style>.test { color: red; }</style>
          <link rel="stylesheet" href="styles.css">
          <meta name="description" content="Test page">
        </head>
        <body>
          <div id="content" class="main-content" style="padding: 10px;">
            <h1>Test Title</h1>
            <img src="test.jpg" alt="Test image">
            <noscript>JavaScript is disabled</noscript>
          </div>
        </body>
      </html>
    `;

    // Mock document.cloneNode
    document.cloneNode = jest.fn().mockReturnValue({
      documentElement: {
        querySelectorAll: jest.fn().mockImplementation((selector) => {
          if (selector === "script, style, link, meta, noscript") {
            return [
              { remove: jest.fn() },
              { remove: jest.fn() },
              { remove: jest.fn() }
            ];
          } else if (selector === "*") {
            return [
              { removeAttribute: jest.fn() },
              { removeAttribute: jest.fn() }
            ];
          } else if (selector === "img") {
            return [
              { 
                alt: "Test image", 
                replaceWith: jest.fn()
              }
            ];
          }
          return [];
        }),
        outerHTML: '<html><body><h1>Test Title</h1>[Image: Test image]</body></html>'
      }
    });
  });

  test('should extract page content and clean it', () => {
    const result = extractPageContent();
    expect(result).toBe('<html><body><h1>Test Title</h1>[Image: Test image]</body></html>');
  });

  test('should handle errors gracefully', () => {
    document.cloneNode = jest.fn().mockImplementation(() => {
      throw new Error('Test error');
    });
    
    console.error = jest.fn();
    const result = extractPageContent();
    
    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});

describe('compressHtml', () => {
  test('should compress HTML content', async () => {
    console.log = jest.fn();
    
    const result = await compressHtml('<html><body>Test Content</body></html>');
    
    expect(result).toBe('dGVzdA==');
    expect(console.log).toHaveBeenCalledTimes(3);
  });
});

describe('processContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  test('should process content successfully', async () => {
    // Setup mocks for successful API calls
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.url.includes('actuator/info')) {
        callback({ success: true, data: { status: 200 } });
      } else {
        callback({
          success: true,
          data: {
            status: 200,
            body: JSON.stringify({ recipe: 'Test Recipe' })
          }
        });
      }
    });

    global.showResult = jest.fn();
    
    const tab = { url: 'https://example.com', title: 'Example' };
    const htmlContent = '<html><body>Test Content</body></html>';
    
    await processContent(tab, htmlContent);
    
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
    expect(console.error).not.toHaveBeenCalled();
  });

  test('should handle API errors', async () => {
    // Setup mocks for API errors
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.url.includes('actuator/info')) {
        callback({ success: true, data: { status: 200 } });
      } else {
        callback({
          success: false,
          error: 'API Error'
        });
      }
    });

    global.showError = jest.fn();
    
    const tab = { url: 'https://example.com', title: 'Example' };
    const htmlContent = '<html><body>Test Content</body></html>';
    
    await processContent(tab, htmlContent);
    
    expect(console.error).toHaveBeenCalled();
  });

  test('should handle non-200 status codes', async () => {
    // Setup mocks for non-200 status
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.url.includes('actuator/info')) {
        callback({ success: true, data: { status: 200 } });
      } else {
        callback({
          success: true,
          data: {
            status: 400,
            body: 'Bad Request'
          }
        });
      }
    });

    global.showError = jest.fn();
    
    const tab = { url: 'https://example.com', title: 'Example' };
    const htmlContent = '<html><body>Test Content</body></html>';
    
    await processContent(tab, htmlContent);
    
    expect(console.error).toHaveBeenCalled();
  });

  test('should handle JSON parsing errors', async () => {
    // Setup mocks for JSON parsing errors
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.url.includes('actuator/info')) {
        callback({ success: true, data: { status: 200 } });
      } else {
        callback({
          success: true,
          data: {
            status: 200,
            body: '{invalid json'
          }
        });
      }
    });

    global.showError = jest.fn();
    
    const tab = { url: 'https://example.com', title: 'Example' };
    const htmlContent = '<html><body>Test Content</body></html>';
    
    await processContent(tab, htmlContent);
    
    expect(console.error).toHaveBeenCalled();
  });
});

describe('showResult', () => {
  test('should show the result and hide other elements', () => {
    const statusElement = { style: { display: 'block' } };
    const resultElement = { style: { display: 'none' } };
    const errorElement = { style: { display: 'block' } };
    const resultContent = { innerHTML: 'old content', appendChild: jest.fn() };
    
    document.getElementById.mockImplementation((id) => {
      if (id === 'status') return statusElement;
      if (id === 'result') return resultElement;
      if (id === 'error') return errorElement;
      if (id === 'result-content') return resultContent;
      return null;
    });
    
    showResult({ test: 'data' });
    
    expect(statusElement.style.display).toBe('none');
    expect(errorElement.style.display).toBe('none');
    expect(resultElement.style.display).toBe('block');
    expect(resultContent.innerHTML).toBe('');
    expect(resultContent.appendChild).toHaveBeenCalled();
  });
});

describe('showError', () => {
  test('should show the error message and hide other elements', () => {
    const statusElement = { style: { display: 'block' } };
    const resultElement = { style: { display: 'block' } };
    const errorElement = { style: { display: 'none' }, textContent: '' };
    const retryButton = { style: { display: 'none' } };
    
    document.getElementById.mockImplementation((id) => {
      if (id === 'status') return statusElement;
      if (id === 'result') return resultElement;
      if (id === 'error') return errorElement;
      if (id === 'retry-button') return retryButton;
      return null;
    });
    
    showError('Test error message');
    
    expect(statusElement.style.display).toBe('none');
    expect(resultElement.style.display).toBe('none');
    expect(errorElement.style.display).toBe('block');
    expect(errorElement.textContent).toBe('Error: Test error message');
    expect(retryButton.style.display).toBe('block');
  });
});

describe('formatJson', () => {
  // Instead of testing implementation details, let's focus on functionality
  test('should return a DOM element for object input', () => {
    // Reset mocks
    jest.clearAllMocks();

    // Create a mock div element that we'll return from createElement
    const mockRootDiv = {
      className: '',
      appendChild: jest.fn()
    };

    // Make document.createElement return our mockRootDiv for the first call
    document.createElement.mockImplementationOnce(() => mockRootDiv);

    // For subsequent calls, return mock elements
    document.createElement.mockImplementation(() => ({
      className: '',
      textContent: '',
      appendChild: jest.fn()
    }));

    // Call formatJson with a test object
    const result = formatJson({ name: 'John', age: 30 });

    // Verify that the function returned our root div
    expect(result).toBe(mockRootDiv);

    // Verify that appendChild was called on our root div
    // (without asserting exactly how many times)
    expect(mockRootDiv.appendChild).toHaveBeenCalled();

    // Verify that document.createElement was called with 'div'
    expect(document.createElement).toHaveBeenCalledWith('div');
  });
  
  test('should handle primitive values correctly', () => {
    // Reset mocks
    jest.clearAllMocks();

    // For primitive values, the function should still create a div and a span
    const mockDiv = {
      className: '',
      appendChild: jest.fn()
    };
    
    let mockSpan;

    document.createElement.mockImplementation((tag) => {
      if (tag === 'div') {
        return mockDiv;
      }
      if (tag === 'span') {
        mockSpan = {
          className: '',
          textContent: ''
        };
        return mockSpan;
      }
      return {};
    });
    
    // Test string handling
    formatJson('test string');
    expect(mockDiv.appendChild).toHaveBeenCalled();
    expect(mockSpan.className).toBe('string');
    expect(mockSpan.textContent).toBe('test string');
    
    // Reset mocks for the next test
    jest.clearAllMocks();
    mockDiv.appendChild.mockClear();

    // Test number handling
    formatJson(42);
    expect(mockDiv.appendChild).toHaveBeenCalled();
    expect(mockSpan.className).toBe('number');
    expect(mockSpan.textContent).toBe('42');
  });
});