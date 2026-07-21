import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowDown, ArrowUp, Download, FileOutput, FilePlus2, GripVertical, Printer, Settings2, Trash2 } from 'lucide-react'
import './App.css'

type SourceFile = { id: string; name: string; content: string }
type JoinMode = 'plain' | 'line' | 'heading'

const makeDocument = (files: SourceFile[], mode: JoinMode) => files.map((file) => {
  const content = file.content.trim()
  return mode === 'heading' ? `# ${file.name.replace(/\.(md|markdown)$/i, '')}\n\n${content}` : content
}).filter(Boolean).join(mode === 'line' ? '\n\n---\n\n' : '\n\n')

const downloadFile = (content: BlobPart, name: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url)
}

export default function App() {
  const [files, setFiles] = useState<SourceFile[]>([])
  const [joinMode, setJoinMode] = useState<JoinMode>('line')
  const [outputName, setOutputName] = useState('merged-document')
  const [isDragging, setIsDragging] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const markdown = useMemo(() => makeDocument(files, joinMode), [files, joinMode])

  const addFiles = async (incoming: FileList | File[]) => {
    const accepted = Array.from(incoming).filter((file) => /\.(md|markdown)$/i.test(file.name))
    if (!accepted.length) return setNotice('请选择 .md 或 .markdown 文件。')
    const entries = await Promise.all(accepted.map(async (file) => ({ id: crypto.randomUUID(), name: file.name, content: await file.text() })))
    setFiles((current) => [...current, ...entries]); setNotice(`已添加 ${entries.length} 个文件。`)
  }
  const moveFile = (from: number, to: number) => {
    if (to < 0 || to >= files.length) return
    setFiles((current) => { const next = [...current]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); return next })
  }
  const dropAt = (target: string) => {
    if (!draggedId || target === draggedId) return
    setFiles((current) => { const next = [...current]; const from = next.findIndex((file) => file.id === draggedId); const to = next.findIndex((file) => file.id === target); const [moved] = next.splice(from, 1); next.splice(to, 0, moved); return next })
    setDraggedId(null)
  }
  const printPdf = () => {
    const content = previewRef.current?.innerHTML
    if (!content) return
    const printWindow = window.open('', '_blank', 'noopener,noreferrer')
    if (!printWindow) return setNotice('浏览器阻止了打印窗口，请允许弹出窗口后重试。')
    printWindow.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${outputName || 'merged-document'}</title><style>@page{size:A4;margin:20mm 18mm}body{color:#2c2c34;font-family:Georgia,"Noto Serif SC","Microsoft YaHei",serif;font-size:11pt;line-height:1.75}h1,h2,h3,h4{color:#050038;font-family:Arial,"Microsoft YaHei",sans-serif;break-after:avoid}h1{font-size:22pt}h2{font-size:17pt;margin-top:22pt}h3{font-size:14pt;margin-top:18pt}p{margin:0 0 10pt}pre{padding:10pt;white-space:pre-wrap;background:#f7f8fa;border-radius:4pt;font-size:8.5pt}code{font-family:Consolas,monospace;background:#f7f8fa;padding:1pt 3pt}pre code{background:transparent;padding:0}blockquote{margin:10pt 0;padding-left:12pt;border-left:3pt solid #4262ff;color:#555a6a}table{width:100%;border-collapse:collapse;margin:10pt 0;font-size:9.5pt}th,td{border:1px solid #e0e2e8;padding:5pt;text-align:left}th{background:#f7f8fa}img{max-width:100%}hr{border:0;border-top:1px solid #c7cad5;margin:18pt 0}</style></head><body>${content}</body></html>`)
    printWindow.document.close()
    printWindow.addEventListener('load', () => printWindow.print(), { once: true })
    setNotice('已打开打印窗口，请在目标中选择“另存为 PDF”。')
  }

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">J</span><span>Joint MD</span></div><div className="local-state"><i />本地处理</div></header>
    <section className="workspace">
      <aside className="control-panel">
        <div className="panel-heading"><div><p>文件队列</p><h1>合并 Markdown</h1></div>{files.length > 0 && <span className="count">{files.length}</span>}</div>
        <div className={`drop-zone ${isDragging ? 'active' : ''}`} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setIsDragging(false); void addFiles(event.dataTransfer.files) }}>
          <FilePlus2 size={26} /><strong>拖入 Markdown 文件</strong><span>支持多个 .md 与 .markdown 文件</span><button className="secondary-button" type="button" onClick={() => inputRef.current?.click()}>选择文件</button><input ref={inputRef} type="file" accept=".md,.markdown,text/markdown,text/plain" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => { if (event.target.files) void addFiles(event.target.files); event.target.value = '' }} />
        </div>
        <div className="file-list">{files.length === 0 ? <div className="empty-list">添加文件后，可通过拖动或箭头调整合并顺序。</div> : files.map((file, index) => <article className="file-row" key={file.id} draggable onDragStart={() => setDraggedId(file.id)} onDragEnd={() => setDraggedId(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropAt(file.id)}><GripVertical className="drag-handle" size={17} /><span className="file-index">{String(index + 1).padStart(2, '0')}</span><span className="file-name" title={file.name}>{file.name}</span><div className="row-actions"><button className="icon-button" type="button" title="上移" aria-label={`上移 ${file.name}`} disabled={index === 0} onClick={() => moveFile(index, index - 1)}><ArrowUp size={15} /></button><button className="icon-button" type="button" title="下移" aria-label={`下移 ${file.name}`} disabled={index === files.length - 1} onClick={() => moveFile(index, index + 1)}><ArrowDown size={15} /></button><button className="icon-button danger" type="button" title="移除" aria-label={`移除 ${file.name}`} onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))}><Trash2 size={15} /></button></div></article>)}</div>
        <div className="settings"><div className="settings-title"><Settings2 size={17} />合并设置</div><label htmlFor="name">导出文件名</label><input id="name" value={outputName} onChange={(event) => setOutputName(event.target.value)} /><fieldset><legend>文件之间</legend><label><input type="radio" name="join" checked={joinMode === 'plain'} onChange={() => setJoinMode('plain')} />留出空行</label><label><input type="radio" name="join" checked={joinMode === 'line'} onChange={() => setJoinMode('line')} />插入分隔线</label><label><input type="radio" name="join" checked={joinMode === 'heading'} onChange={() => setJoinMode('heading')} />加上文件标题</label></fieldset></div>
      </aside>
      <section className="preview-panel"><div className="preview-header"><div><p>实时预览</p><h2>{outputName || 'merged-document'}.md</h2></div><span>{files.length ? `${files.length} 个文件 · ${markdown.length.toLocaleString()} 个字符` : '等待文件'}</span></div><div ref={previewRef} className={`preview-content ${markdown ? '' : 'is-empty'}`}>{markdown ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown> : <div><FileOutput size={34} /><p>合并后的文档会显示在这里</p></div>}</div><footer className="export-bar"><span role="status">{notice}</span><div><button className="secondary-button" type="button" disabled={!markdown} onClick={() => downloadFile(markdown, `${outputName || 'merged-document'}.md`, 'text/markdown;charset=utf-8')}><Download size={17} />导出 Markdown</button><button className="primary-button" type="button" disabled={!markdown} onClick={printPdf}><Printer size={17} />打印为 PDF</button></div></footer></section>
    </section>
  </main>
}

