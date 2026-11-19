import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Explain, { fill } from '../components/common/Explain';
import { Glossary, SummaryContext } from '../context/SummaryContext';

const glossary: Glossary = {
  'model.p': {
    title: "A draft's P (regression)",
    formula: ['P = E[σ(xβ)] ≈ σ(μ / √(1 + π s²/8))'],
    here: ['μ = {mu}, s = {s}', 'P = {p}'],
    vars: ['mu', 's', 'p'],
  },
};

const withGlossary = (ui: React.ReactElement) =>
  render(<SummaryContext.Provider value={{ summary: {}, glossary }}>{ui}</SummaryContext.Provider>);

describe('fill', () => {
  it('puts row values into the placeholders and leaves unknown ones visible', () => {
    expect(fill('μ = {mu}, n = {n}, x = {x}', { mu: -3.4012, n: 12 })).toBe('μ = -3.401, n = 12, x = {x}');
    expect(fill('{big}', { big: 21.94 })).toBe('21.9');
    expect(fill('{none}', { none: null })).toBe('–');
  });
});

describe('Explain', () => {
  it('opens the formula and this draft’s numbers on focus, and closes on Escape', () => {
    withGlossary(<Explain k="model.p" vars={{ mu: -3.4, s: 0.41, p: 0.034 }}>0.034</Explain>);
    const value = screen.getByRole('button', { name: /0.034/ });
    fireEvent.focus(value);
    expect(screen.getByRole('tooltip')).toHaveTextContent("A draft's P (regression)");
    expect(screen.getByRole('tooltip')).toHaveTextContent('μ = -3.400, s = 0.410');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('stays open after a tap until tapped again', () => {
    withGlossary(<Explain k="model.p" vars={{ mu: 1, s: 1, p: 0.5 }}>0.5</Explain>);
    const value = screen.getByRole('button', { name: /0.5/ });
    fireEvent.click(value);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.click(value);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('is plain text when there is no entry (the mentor view, or an unknown key)', () => {
    withGlossary(<Explain k="nope">42</Explain>);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});
