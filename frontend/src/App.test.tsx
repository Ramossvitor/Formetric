import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('apresenta a home demonstrativa com identificação explícita', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Hoje' })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Todos os valores abaixo são ilustrativos')
    expect(screen.getByText(/nenhum dado foi registrado ou calculado/i)).toBeInTheDocument()
  })

  it('oferece navegação e ações rápidas com nomes acessíveis', () => {
    render(<App />)

    const navigations = screen.getAllByRole('navigation', { name: 'Navegação principal' })
    expect(navigations).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Hoje' })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Abrir cadastro rápido' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar água' })).toBeInTheDocument()
  })

  it('expõe indicadores de progresso com valores compreensíveis', () => {
    render(<App />)

    expect(
      screen.getByRole('progressbar', { name: '1.850 de 2.500 quilocalorias consumidas' }),
    ).toHaveAttribute('aria-valuenow', '1850')
    expect(screen.getByRole('progressbar', { name: 'Proteína: 93% da meta' })).toHaveAttribute(
      'aria-valuemax',
      '100',
    )
    expect(screen.getByRole('progressbar', { name: 'Ciclo atual: 28 de 35 dias' })).toHaveAttribute(
      'aria-valuenow',
      '28',
    )
  })
})
