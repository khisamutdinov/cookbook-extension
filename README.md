# Recipe Extractor Browser Extension

A Chrome extension that analyzes webpage content and extracts recipe information using machine learning.

![Extension Screenshot](./icon.png)

## Features

- Content-focused HTML analysis
- Cleaned HTML payload processing
- JSON API integration with <https://cookbook-577683305271.us-west1.run.app>
- Detailed error handling and retry mechanism
- Interactive JSON formatting with syntax highlighting

## Installation

1. Clone repository
```bash
git clone https://github.com/yourusername/recipe-extractor-extension.git
```

2. Install dependencies (none required - pure browser extension)

3. Chrome Setup:
   - Go to `chrome://extensions`
   - Enable "Developer mode" (top-right toggle)
   - Click "Load unpacked" and select the extension directory

## Configuration

Create `.env.local` with API credentials:
```javascript
// in extension-functions.js
const token = "YOUR_API_TOKEN_HERE"; // Replace with your actual token
```

## Development

```bash
# Build extension package
zip -r recipe-extractor.zip manifest.json *.js *.html *.css icon.png

# Reload extension during development:
# 1. Make code changes
# 2. Click "Refresh" on extension card in chrome://extensions
```

## Contributed Files

```
git log --pretty=format:"%h %s" 
affd0ba feat: Clean HTML payload by removing non-content elements  
1f1eb23 feat: Improve JSON display in popup with syntax highlighting
358f284 feat: Add API integration for HTML analysis              
1c9cc2b feat: add initial chrome extension setup for html viewer
```

## License

MIT License - see [LICENSE](LICENSE) file
