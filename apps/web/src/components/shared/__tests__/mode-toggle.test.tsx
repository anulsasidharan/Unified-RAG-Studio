/** @vitest-environment jsdom */
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockPathname = vi.fn(() => '/');
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

import { ModeToggle } from '@/components/shared/mode-toggle';

describe('ModeToggle', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/');
  });

  it('highlights Designer on nested designer routes', () => {
    mockPathname.mockReturnValue('/designer/chunking');
    render(<ModeToggle />);
    const designer = screen.getByRole('link', { name: /^Designer$/i });
    expect(designer).toHaveAttribute('href', '/designer');
    expect(designer.className).toMatch(/primary-600/);
  });

  it('highlights Autopilot under /autopilot', () => {
    mockPathname.mockReturnValue('/autopilot/build/123');
    render(<ModeToggle />);
    const ap = screen.getByRole('link', { name: /^Autopilot$/i });
    expect(ap).toHaveAttribute('href', '/autopilot');
    expect(ap.className).toMatch(/primary-600/);
  });
});
