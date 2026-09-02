import { act, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode, useState } from 'react'
import { useSheetHistory } from './useSheetHistory'

function Sheet({ name, onClose }: { name: string; onClose: () => void }) {
  useSheetHistory(onClose)
  return <p>{name}</p>
}

// O `history.back()` do jsdom é assíncrono, como no navegador: a entrada só sai, e o `popstate` só
// dispara, dezenas de milissegundos depois. A espera é generosa para que um `back()` indevido tenha
// tempo de aparecer nas asserções negativas.
async function settleHistory() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 80))
  })
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('entrada de histórico do sheet', () => {
  it('não fecha o sheet que o StrictMode monta duas vezes', async () => {
    const onClose = vi.fn()
    const before = window.history.length

    render(<StrictMode><Sheet name="A" onClose={onClose} /></StrictMode>)
    await settleHistory()

    expect(onClose).not.toHaveBeenCalled()
    expect(window.history.length).toBe(before + 1)
    expect(window.history.state).toEqual({ formetricSheet: true })
  })

  it('mantém aberto o sheet que substitui outro no mesmo commit', async () => {
    // O sheet de ações da linha abre "Editar": o primeiro desmonta e o segundo monta juntos. A
    // limpeza do primeiro não pode desfazer a entrada que o segundo acabou de reaproveitar.
    const closeB = vi.fn()
    function Host() {
      const [which, setWhich] = useState<'A' | 'B'>('A')
      return (
        <>
          {which === 'A' ? <Sheet name="A" onClose={() => {}} /> : null}
          {which === 'B' ? <Sheet name="B" onClose={closeB} /> : null}
          <button onClick={() => setWhich('B')} type="button">Editar</button>
        </>
      )
    }

    render(<Host />)
    await settleHistory()
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    await settleHistory()

    expect(screen.getByText('B')).toBeInTheDocument()
    expect(closeB).not.toHaveBeenCalled()
    expect(window.history.state).toEqual({ formetricSheet: true })
  })

  it('remove a entrada ao fechar o último sheet pelo botão', async () => {
    function Host() {
      const [open, setOpen] = useState(true)
      return (
        <>
          {open ? <Sheet name="A" onClose={() => setOpen(false)} /> : null}
          <button onClick={() => setOpen(false)} type="button">Fechar</button>
        </>
      )
    }

    render(<Host />)
    await settleHistory()
    expect(window.history.state).toEqual({ formetricSheet: true })

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    await settleHistory()

    expect(screen.queryByText('A')).not.toBeInTheDocument()
    expect(window.history.state).toBeNull()
  })

  it('mantém aberto o sheet reaberto antes de a entrada anterior terminar de sair', async () => {
    // Fechar e abrir de novo em seguida: o `back()` do primeiro ainda está em voo quando o segundo
    // monta. O segundo espera a saída e só então ganha a própria entrada.
    const closeSecond = vi.fn()
    function Host() {
      const [generation, setGeneration] = useState(1)
      const [open, setOpen] = useState(true)
      return (
        <>
          {open ? <Sheet key={generation} name={`Sheet ${generation}`} onClose={generation === 1 ? () => setOpen(false) : closeSecond} /> : null}
          <button onClick={() => setOpen(false)} type="button">Fechar</button>
          <button onClick={() => { setGeneration(2); setOpen(true) }} type="button">Reabrir</button>
        </>
      )
    }

    render(<Host />)
    await settleHistory()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }))
    await settleHistory()

    expect(screen.getByText('Sheet 2')).toBeInTheDocument()
    expect(closeSecond).not.toHaveBeenCalled()
    expect(window.history.state).toEqual({ formetricSheet: true })

    // E o gesto de voltar continua fechando o sheet reaberto.
    act(() => window.history.back())
    await settleHistory()
    expect(closeSecond).toHaveBeenCalledTimes(1)
  })

  it('fecha o sheet no gesto de voltar', async () => {
    const onClose = vi.fn()

    render(<Sheet name="A" onClose={onClose} />)
    await settleHistory()
    act(() => window.history.back())
    await settleHistory()

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(window.history.state).toBeNull()
  })
})
