interface ComingSoonPageProps {
  eyebrow: string
  title: string
  description: string
}

export function ComingSoonPage({ eyebrow, title, description }: ComingSoonPageProps) {
  return (
    <main id="conteudo">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="heading-copy">{description}</p>
        </div>
      </header>
      <section className="empty-state surface-card">
        <span aria-hidden="true">◌</span>
        <h2>Em construção</h2>
        <p>Esta área já está protegida e preparada para receber o próximo incremento.</p>
      </section>
    </main>
  )
}
