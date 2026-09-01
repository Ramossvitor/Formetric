import { ActivityDialog } from '../activity/ActivityDialog'

/**
 * Confirmação de exclusão definitiva, no estilo do app.
 *
 * Substitui o `window.confirm`, que num celular é um alerta do sistema operacional: aparece em
 * posição imprevisível, ignora o tema, e a distinção entre "OK" e "Cancelar" fica com o sistema, não
 * com o produto — num diálogo onde a diferença é perder um registro.
 *
 * Aqui há confirmação, e não desfazer, porque o backend não tem restauração para estes registros:
 * o `DELETE` é definitivo. Onde existe restauração — alimento, receita, avaliação corporal — o
 * padrão é o oposto, e a ação acontece na hora com "Desfazer" no aviso.
 */
export function ConfirmDelete({ busy, description, onCancel, onConfirm, title }: {
  busy: boolean
  description: string
  onCancel: () => void
  onConfirm: () => void
  title: string
}) {
  return (
    <ActivityDialog dismissible={!busy} onClose={onCancel} title={title}>
      <div className="dialog-form">
        <p className="close-copy">{description}</p>
        <div className="dialog-actions">
          <button className="secondary-button" disabled={busy} onClick={onCancel} type="button">Manter</button>
          <button className="submit-button danger-submit" disabled={busy} onClick={onConfirm} type="button">
            {busy ? 'Excluindo…' : 'Excluir'}
          </button>
        </div>
      </div>
    </ActivityDialog>
  )
}
