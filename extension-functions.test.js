import {
  extractPageContent,
  showResult,
  showError,
  formatJson,
  compressHtml
} from './extension-functions.js';

describe('DOM Content Extraction', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <html>
        <head>
          <script src="test.js"></script>
          <style>.test { color: red; }</style>
          <meta charset="utf-8">
        </head>
        <body>
          <div class="content" id="main" style="font-size: 14px">
            <h1>Test Page</h1>
            <img src="test.jpg" alt="Test image">
            <img src="no-alt.jpg">
            <noscript>Require JS</noscript>
            <link rel="stylesheet" href="styles.css">
          </div>
        </body>
      </html>
    `;
  });

  test('extractPageContent sanitizes DOM correctly', () => {
    const result = extractPageContent();
    
    // Verify removal of non-content elements
    expect(result).not.toContain('<script');
    expect(result).not.toContain('<style');
    expect(result).not.toContain('<meta');
    expect(result).not.toContain('<noscript');
    expect(result).not.toContain('<link');
    
    // Verify attribute removal
    expect(result).toContain('<div>'); // Should have no class/id/style
    expect(result).not.toContain('class="content"');
    expect(result).not.toContain('id="main"');
    expect(result).not.toContain('style="font-size: 14px"');
    
    // Verify image replacement
    expect(result).toContain('[Image: Test image]');
    expect(result).toContain('[Image: No alt text]');
  });
});

describe('JSON Formatting', () => {
  test('formatJson handles complex objects', () => {
    const testData = {
      string: 'value',
      number: 42,
      nested: { bool: true, another: null },
      array: [1, 'two', false]
    };

    const formatted = formatJson(testData);
    
    // Verify structure accounting for nested entries
    const entries = formatted.querySelectorAll('.json-entry');
    expect(entries.length).toBe(4);
    
    // Verify value types
    const valueSpans = formatted.querySelectorAll('.json-value');
    expect(valueSpans[0].querySelector('span.string').textContent).toBe('value');
    expect(valueSpans[1].querySelector('span.number').textContent).toBe('42');
    expect(valueSpans[2].querySelector('.json-entry .json-key').textContent).toContain('bool');
    expect(valueSpans[3].querySelector('span.number').textContent).toBe('1');
  });
});

describe('UI Functions', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="status"></div>
      <div id="result" style="display: none">
        <div id="result-content"></div>
      </div>
      <div id="error" style="display: none"></div>
      <button id="retry-button"></button>
    `;
  });

  test('showResult updates UI correctly', () => {
    const testData = { message: 'Success' };
    showResult(testData);

    expect(document.getElementById('status').style.display).toBe('none');
    expect(document.getElementById('result').style.display).toBe('block');
    expect(document.getElementById('error').style.display).toBe('none');
    expect(document.querySelector('.json-entry .json-key').textContent).toContain('message');
  });

  test('showError updates UI correctly', () => {
    showError('Test error');

    expect(document.getElementById('status').style.display).toBe('none');
    expect(document.getElementById('result').style.display).toBe('none');
    expect(document.getElementById('error').style.display).toBe('block');
    expect(document.getElementById('error').textContent).toContain('Test error');
    expect(document.getElementById('retry-button').style.display).toBe('block');
  });
});

describe('Compression', () => {
  // Mock Blob.stream() polyfill
  if (!Blob.prototype.stream) {
    Blob.prototype.stream = function() {
      return new ReadableStream({
        start(controller) {
          const reader = new FileReader();
          reader.onload = () => {
            controller.enqueue(reader.result);
            controller.close();
          };
          reader.readAsArrayBuffer(this);
        }.bind(this)
      });
    };
  }

  test('compressHtml reduces size', async () => {
    const testHtml = '<div>'.repeat(1000); // ~5000 chars
    const compressed = await compressHtml(testHtml);
    
    expect(typeof compressed).toBe('string');
    expect(compressed.length).toBeLessThanOrEqual(testHtml.length);
    expect(compressed).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64 regex
  });
});

// Mock chrome API
global.chrome = {
  runtime: {
    id: 'test-extension',
    sendMessage: jest.fn((message, callback) => {
      if (message.url.includes('actuator/info')) {
        callback({ success: true, data: { status: 200, body: 'OK' } });
      } else {
        callback({ success: true, data: { status: 200, body: '{"result": "success"}' } });
      }
    })
  }
};
