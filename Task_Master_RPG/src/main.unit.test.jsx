import { describe, it, expect, vi, beforeEach } from 'vitest';

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));

vi.mock('react-dom/client', () => ({
  createRoot: createRootMock,
}));

vi.mock('./App.jsx', () => ({
  default: () => null,
}));
vi.mock('./styles/index.css', () => ({}));

describe('main entry', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    renderMock.mockClear();
    createRootMock.mockClear();
    vi.resetModules();
  });

  it('mounts app into #root', async () => {
    await import('./main.jsx');

    expect(createRootMock).toHaveBeenCalledWith(document.getElementById('root'));
    expect(renderMock).toHaveBeenCalledTimes(1);
  });
});
