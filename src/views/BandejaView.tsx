import { useMemo, useState } from 'react'
import { Modal } from '../components/Modal'
import { ErrorState, LoadingState } from '../components/Feedback'
import { IconInbox } from '../components/Icons'
import { formatShortDate } from '../lib/dates'
import { richTextExcerpt } from '../lib/rich-text'
import { useAppState, useDiscardProposal, useTakeProposal } from '../lib/store'
import { resolveAcceptCategory, type CategoryPick } from '../shared/proposals'
import type { Proposal, TakeProposalInput, Urgency } from '../shared/types'
import styles from './BandejaView.module.css'

const URGENCY_LABEL: Record<Urgency, string> = { baja: 'Baja', media: 'Media', alta: 'Alta' }

export function BandejaView() {
  const { data, isPending, error } = useAppState()
  const discard = useDiscardProposal()
  const [taking, setTaking] = useState<Proposal | null>(null)

  const categories = data?.categories ?? []
  const proposals = useMemo(
    () =>
      [...(data?.proposals ?? [])].sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      ),
    [data?.proposals],
  )

  return (
    <div className={`${styles.page} pageEnter`}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          <IconInbox size={22} />
          Bandeja
        </h1>
        <p className={styles.subtitle}>Lo que el bot propone. Todavía no es una tarea.</p>
      </header>

      {isPending ? <LoadingState /> : null}
      {error ? <ErrorState error={error} /> : null}

      {!isPending && !error && proposals.length === 0 ? (
        <p className={styles.empty}>Nada por tomar. Cuando el bot mande una propuesta, aparece acá.</p>
      ) : null}

      {!isPending && !error && proposals.length > 0 ? (
        <ul className={styles.list}>
          {proposals.map((proposal) => (
            <li key={proposal.id} className={styles.card}>
              <div className={styles.cardBody}>
                <h2 className={styles.cardTitle}>{proposal.title}</h2>
                <p className={styles.meta}>
                  <span className={`${styles.urgency} ${styles[`urgency_${proposal.urgency}`]}`}>
                    {URGENCY_LABEL[proposal.urgency]}
                  </span>
                  {proposal.deadline ? <span>{formatShortDate(proposal.deadline)}</span> : null}
                  <CategoryHint proposal={proposal} categories={categories} />
                  <Origin proposal={proposal} />
                </p>
                {proposal.description ? (
                  <p className={styles.excerpt}>{richTextExcerpt(proposal.description, 180)}</p>
                ) : null}
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.take} onClick={() => setTaking(proposal)}>
                  Tomar
                </button>
                <button
                  type="button"
                  className={styles.drop}
                  disabled={discard.isPending}
                  onClick={() => discard.mutate(proposal.id)}
                >
                  Tirar
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {taking ? (
        <TakeStep
          proposal={taking}
          categories={categories}
          onClose={() => setTaking(null)}
        />
      ) : null}
    </div>
  )
}

function CategoryHint({ proposal, categories }: { proposal: Proposal; categories: CategoryPick[] }) {
  const plan = resolveAcceptCategory(
    { categoryId: proposal.categoryId, categoryName: proposal.categoryName },
    categories,
  )
  if (plan.kind === 'none') return null
  const name =
    plan.kind === 'existing'
      ? (categories.find((item) => item.id === plan.categoryId)?.name ?? proposal.categoryName)
      : plan.name
  if (!name) return null
  return <span>{name}</span>
}

function Origin({ proposal }: { proposal: Proposal }) {
  if (!proposal.origen && !proposal.origenUrl) return null
  if (proposal.origenUrl) {
    return (
      <a href={proposal.origenUrl} target="_blank" rel="noreferrer">
        {proposal.origen ?? 'Origen'}
      </a>
    )
  }
  return <span>{proposal.origen}</span>
}

function openingCategory(proposal: Proposal, categories: CategoryPick[]) {
  const plan = resolveAcceptCategory(
    { categoryId: proposal.categoryId, categoryName: proposal.categoryName },
    categories,
  )
  if (plan.kind === 'existing') {
    const live = categories.find((item) => item.id === plan.categoryId)
    return { categoryId: plan.categoryId, categoryName: live?.name ?? '' }
  }
  if (plan.kind === 'create') return { categoryId: null, categoryName: plan.name }
  return { categoryId: null, categoryName: '' }
}

function TakeStep({
  proposal,
  categories,
  onClose,
}: {
  proposal: Proposal
  categories: CategoryPick[]
  onClose: () => void
}) {
  const take = useTakeProposal()
  const initial = openingCategory(proposal, categories)
  const [categoryId, setCategoryId] = useState<string | null>(initial.categoryId)
  const [categoryName, setCategoryName] = useState(initial.categoryName)
  const [deadline, setDeadline] = useState(proposal.deadline ?? '')
  const [inToday, setInToday] = useState(false)

  const preview = resolveAcceptCategory({ categoryId, categoryName }, categories)

  function onNameChange(value: string) {
    setCategoryName(value)
    // Si no toco el texto, sigue el id que vio el bot. Si lo cambio, manda el
    // nombre y el servidor engancha o crea. Dos listas pueden llamarse igual.
    const pinned = categories.find((item) => item.id === initial.categoryId)
    setCategoryId(pinned && pinned.name === value ? pinned.id : null)
  }

  async function confirm() {
    const plan = resolveAcceptCategory({ categoryId, categoryName }, categories)
    const body: TakeProposalInput = {
      deadline: deadline || null,
      inToday,
      categoryId: plan.kind === 'existing' ? plan.categoryId : null,
      categoryName:
        plan.kind === 'create'
          ? plan.name
          : plan.kind === 'existing'
            ? (categories.find((item) => item.id === plan.categoryId)?.name ?? null)
            : null,
    }
    try {
      await take.mutateAsync({ id: proposal.id, body })
      onClose()
    } catch {
      // El toast ya cuenta el error y el cache vuelve. El paso queda para reintentar.
    }
  }

  return (
    <Modal
      title="Tomar"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.cancel} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.confirm}
            disabled={take.isPending}
            onClick={() => void confirm()}
          >
            {take.isPending ? 'Tomando…' : 'Tomar'}
          </button>
        </>
      }
    >
      <p className={styles.takeTitle}>{proposal.title}</p>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Categoría</span>
        <input
          className={styles.input}
          value={categoryName}
          maxLength={60}
          placeholder="Sin categoría"
          list="bandeja-categorias"
          autoComplete="off"
          onChange={(event) => onNameChange(event.target.value)}
        />
        <datalist id="bandeja-categorias">
          {categories.map((category) => (
            <option key={category.id} value={category.name} />
          ))}
        </datalist>
        <span className={styles.hint}>
          {preview.kind === 'create'
            ? 'Se va a crear al confirmar'
            : preview.kind === 'none'
              ? 'Sin categoría'
              : 'Usa una categoría que ya existe'}
        </span>
        {categoryName ? (
          <button
            type="button"
            className={styles.clear}
            onClick={() => {
              setCategoryName('')
              setCategoryId(null)
            }}
          >
            Quitar categoría
          </button>
        ) : null}
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Fecha</span>
        <input
          className={styles.input}
          type="date"
          value={deadline}
          onChange={(event) => setDeadline(event.target.value)}
        />
        {deadline ? (
          <button type="button" className={styles.clear} onClick={() => setDeadline('')}>
            Quitar fecha
          </button>
        ) : null}
      </label>

      <label className={styles.check}>
        <input
          type="checkbox"
          checked={inToday}
          onChange={(event) => setInToday(event.target.checked)}
        />
        Poner en Hoy
      </label>
    </Modal>
  )
}
