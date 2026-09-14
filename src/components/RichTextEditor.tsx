import { useEffect, useRef, useState, type ReactNode } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import type { Editor } from '@tiptap/react'
import styles from './RichTextEditor.module.css'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  /** Alto minimo del area de escritura, en px. */
  minHeight?: number
  'aria-label'?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escribí acá…',
  minHeight = 140,
  'aria-label': ariaLabel,
}: Props) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const lastEmitted = useRef(value)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          HTMLAttributes: {
            rel: 'noopener noreferrer nofollow',
            target: '_blank',
          },
        },
      }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editorProps: {
      attributes: {
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
        'data-paste-text': '',
      },
    },
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML()
      lastEmitted.current = html
      onChangeRef.current(html)
    },
  })

  useEffect(() => {
    if (!editor) return
    if (value === lastEmitted.current) return
    lastEmitted.current = value
    editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])

  return (
    <div className={styles.wrap} data-paste-text>
      {editor ? <Toolbar editor={editor} /> : <div className={styles.toolbar} />}
      <EditorContent editor={editor} className={styles.body} style={{ minHeight }} />
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      bold: instance.isActive('bold'),
      italic: instance.isActive('italic'),
      underline: instance.isActive('underline'),
      strike: instance.isActive('strike'),
      highlight: instance.isActive('highlight'),
      h2: instance.isActive('heading', { level: 2 }),
      h3: instance.isActive('heading', { level: 3 }),
      bullet: instance.isActive('bulletList'),
      ordered: instance.isActive('orderedList'),
      task: instance.isActive('taskList'),
      quote: instance.isActive('blockquote'),
      code: instance.isActive('code'),
      codeBlock: instance.isActive('codeBlock'),
      link: instance.isActive('link'),
      canUndo: instance.can().undo(),
      canRedo: instance.can().redo(),
    }),
  })

  function applyLink() {
    const trimmed = linkValue.trim()
    if (!trimmed) {
      editor.chain().focus().unsetLink().run()
      setLinkOpen(false)
      return
    }
    if (/^\s*javascript:/i.test(trimmed)) {
      setLinkOpen(false)
      return
    }
    const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    setLinkOpen(false)
  }

  return (
    <div className={styles.toolbar}>
      <div className={styles.tools} role="toolbar" aria-label="Formato">
        <Group>
          <MarkButton
            label="Negrita"
            active={state.bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <span className={styles.letterBold}>B</span>
          </MarkButton>
          <MarkButton
            label="Cursiva"
            active={state.italic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <span className={styles.letterItalic}>I</span>
          </MarkButton>
          <MarkButton
            label="Subrayado"
            active={state.underline}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <span className={styles.letterUnderline}>U</span>
          </MarkButton>
          <MarkButton
            label="Tachado"
            active={state.strike}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <span className={styles.letterStrike}>S</span>
          </MarkButton>
          <MarkButton
            label="Resaltar"
            active={state.highlight}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
          >
            <IconHighlight />
          </MarkButton>
        </Group>

        <Group>
          <MarkButton
            label="Título"
            active={state.h2}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <span className={styles.headingMark}>
              H<sup>2</sup>
            </span>
          </MarkButton>
          <MarkButton
            label="Subtítulo"
            active={state.h3}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <span className={styles.headingMark}>
              H<sup>3</sup>
            </span>
          </MarkButton>
        </Group>

        <Group>
          <MarkButton
            label="Lista"
            active={state.bullet}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <IconBulletList />
          </MarkButton>
          <MarkButton
            label="Lista numerada"
            active={state.ordered}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <IconOrderedList />
          </MarkButton>
          <MarkButton
            label="Checklist"
            active={state.task}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          >
            <IconTaskList />
          </MarkButton>
        </Group>

        <Group>
          <MarkButton
            label="Cita"
            active={state.quote}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <IconQuote />
          </MarkButton>
          <MarkButton
            label="Código"
            active={state.code}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <IconInlineCode />
          </MarkButton>
          <MarkButton
            label="Bloque de código"
            active={state.codeBlock}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            <IconCodeBlock />
          </MarkButton>
          <MarkButton
            label="Link"
            active={state.link}
            onClick={() => {
              setLinkValue((editor.getAttributes('link').href as string | undefined) ?? '')
              setLinkOpen((open) => !open)
            }}
          >
            <IconLink />
          </MarkButton>
          <MarkButton
            label="Línea"
            active={false}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <IconRule />
          </MarkButton>
        </Group>

        <Group>
          <MarkButton
            label="Deshacer"
            active={false}
            disabled={!state.canUndo}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <IconUndo />
          </MarkButton>
          <MarkButton
            label="Rehacer"
            active={false}
            disabled={!state.canRedo}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <IconRedo />
          </MarkButton>
        </Group>
      </div>

      {linkOpen ? (
        <div className={styles.linkBar}>
          <input
            className={styles.linkInput}
            value={linkValue}
            autoFocus
            placeholder="https://…"
            aria-label="URL del link"
            autoComplete="off"
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                applyLink()
              }
              if (event.key === 'Escape') setLinkOpen(false)
            }}
          />
          <button type="button" className={styles.linkApply} onClick={applyLink}>
            Listo
          </button>
        </div>
      ) : null}
    </div>
  )
}

function Group({ children }: { children: ReactNode }) {
  return <div className={styles.group}>{children}</div>
}

function MarkButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`${styles.btn} ${active ? styles.btnOn : ''}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

const icon = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
}

function IconHighlight() {
  return (
    <svg {...icon}>
      <path d="M15 5 19 9 9 19H5v-4Z" />
      <path d="M18 12h3" />
    </svg>
  )
}

function IconBulletList() {
  return (
    <svg {...icon}>
      <path d="M9 6h12M9 12h12M9 18h12" />
      <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconOrderedList() {
  return (
    <svg {...icon}>
      <path d="M10 6h11M10 12h11M10 18h11" />
      <path d="M4 5v4M4 7h2M3.5 15.5 5 14v6" />
    </svg>
  )
}

function IconTaskList() {
  return (
    <svg {...icon}>
      <rect x="3" y="4" width="6" height="6" rx="1.5" />
      <path d="m4.5 7 1.5 1.5 3-3" />
      <path d="M13 7h8M13 17h8" />
      <rect x="3" y="14" width="6" height="6" rx="1.5" />
    </svg>
  )
}

function IconQuote() {
  return (
    <svg {...icon}>
      <path d="M7 17h4l2-6V7H7v4h4ZM15 17h4l2-6V7h-6v4h4Z" />
    </svg>
  )
}

function IconInlineCode() {
  return (
    <svg {...icon}>
      <path d="m8 8-4 4 4 4M16 8l4 4-4 4" />
    </svg>
  )
}

function IconCodeBlock() {
  return (
    <svg {...icon}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m8 9-2 3 2 3M16 9l2 3-2 3M13 9l-2 6" />
    </svg>
  )
}

function IconLink() {
  return (
    <svg {...icon}>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </svg>
  )
}

function IconRule() {
  return (
    <svg {...icon}>
      <path d="M4 12h16M8 8v8M16 8v8" />
    </svg>
  )
}

function IconUndo() {
  return (
    <svg {...icon}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  )
}

function IconRedo() {
  return (
    <svg {...icon}>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H10a6 6 0 0 0 0 12h3" />
    </svg>
  )
}
