// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.getContext.__codexMocked) {
  const mockGetContext = jest.fn(() => null);
  mockGetContext.__codexMocked = true;
  HTMLCanvasElement.prototype.getContext = mockGetContext;
}
