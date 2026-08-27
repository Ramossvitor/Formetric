import { render, screen } from '@testing-library/react'
import { CatalogCount } from './CatalogState'

const archivedFoods = { gender: 'm', noun: ['alimento arquivado', 'alimentos arquivados'] } as const
const archivedRecipes = { gender: 'f', noun: ['receita arquivada', 'receitas arquivadas'] } as const

// Sem o total do servidor o texto ganha um particípio, que precisa concordar em gênero e número
// com o substantivo — e ele muda entre alimentos e receitas.
const participleCases: Array<{ gender: 'm' | 'f'; noun: readonly [string, string]; loaded: number; expected: string }> = [
  { ...archivedFoods, loaded: 3, expected: '3 alimentos arquivados carregados até agora' },
  { ...archivedFoods, loaded: 1, expected: '1 alimento arquivado carregado até agora' },
  { ...archivedRecipes, loaded: 3, expected: '3 receitas arquivadas carregadas até agora' },
  { ...archivedRecipes, loaded: 1, expected: '1 receita arquivada carregada até agora' },
]

describe('CatalogCount', () => {
  it('mostra a fatia carregada do total enquanto houver páginas', () => {
    render(<CatalogCount gender="m" hasMore loaded={100} noun={['alimento ativo', 'alimentos ativos']} showTotal total={137} />)

    expect(screen.getByText('100 de 137 alimentos ativos')).toBeInTheDocument()
  })

  it('concorda o substantivo com o total, não com o carregado', () => {
    render(<CatalogCount gender="f" hasMore loaded={1} noun={['receita ativa', 'receitas ativas']} showTotal total={2} />)

    expect(screen.getByText('1 de 2 receitas ativas')).toBeInTheDocument()
  })

  for (const { gender, noun, loaded, expected } of participleCases) {
    it(`escreve "${expected}"`, () => {
      render(<CatalogCount gender={gender} hasMore loaded={loaded} noun={noun} showTotal={false} total={0} />)

      expect(screen.getByText(expected)).toBeInTheDocument()
    })
  }

  it('não anuncia "0 arquivadas" enquanto ainda há páginas por carregar', () => {
    render(<CatalogCount gender="f" hasMore loaded={0} noun={archivedRecipes.noun} showTotal={false} total={0} />)

    expect(screen.getByText('Nenhuma receita arquivada nas páginas carregadas até agora.')).toBeInTheDocument()
  })

  it('omite o particípio quando não há mais páginas', () => {
    render(<CatalogCount gender="m" hasMore={false} loaded={2} noun={['alimento ativo', 'alimentos ativos']} showTotal total={2} />)

    expect(screen.getByText('2 alimentos ativos')).toBeInTheDocument()
  })
})
