// Polyfill TextEncoder/TextDecoder for compression tests
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

global.CompressionStream = class {
  constructor(format) {
    this.format = format;
  }
  
  get readable() {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("compressed-data"));
        controller.close();
      }
    });
  }
  
  get writable() {
    return new WritableStream();
  }
};
