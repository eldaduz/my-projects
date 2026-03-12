import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { basicSetup } from 'codemirror'

const lightTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--bg-input)',
    color: 'var(--text-primary)',
  },
  '.cm-content': {
    caretColor: 'var(--emerald-500)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-muted)',
    border: 'none',
  },
})

const CodeEditor = forwardRef(function CodeEditor(
  { value, onChange, disabled, theme = 'dark' },
  ref,
) {
  const editorRef = useRef(null)
  const viewRef = useRef(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useImperativeHandle(
    ref,
    () => ({
      focus() {
        viewRef.current?.focus()
      },
    }),
    [],
  )

  useEffect(() => {
    if (!editorRef.current) return undefined

    const state = EditorState.create({
      doc: value || '',
      extensions: [
        basicSetup,
        javascript({ jsx: true }),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && onChangeRef.current) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
        EditorView.editable.of(!disabled),
        theme === 'dark' ? oneDark : lightTheme,
      ],
    })

    const view = new EditorView({ state, parent: editorRef.current })
    viewRef.current = view

    return () => view.destroy()
  }, [disabled, theme])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const currentValue = view.state.doc.toString()
    if (value !== currentValue) {
      view.dispatch({
        changes: { from: 0, to: currentValue.length, insert: value || '' },
      })
    }
  }, [value])

  return <div className="code-editor-wrapper" ref={editorRef} />
})

export default CodeEditor
