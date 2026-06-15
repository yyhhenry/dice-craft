import hljs from "highlight.js/lib/common"
import "highlight.js/styles/github-dark.min.css"
import { useMemo } from "react"
import type React from "react"
import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

function extractCodeBlock(children: React.ReactNode): { code: string; lang: string } | undefined {
  if (!children || typeof children !== "object" || !("props" in children) || !children.props) {
    return
  }

  const props = children.props as { className?: string; children?: React.ReactNode }
  const className = props.className || ""
  const match = /language-(\w+)/.exec(className)
  if (!match) return

  const lang = match[1]
  const code = props.children ? String(props.children).replace(/\n$/, "") : ""
  return { code, lang }
}

const markdownComponents: Components = {
  pre: ({ children, ...props }) => {
    const codeBlock = extractCodeBlock(children)
    if (codeBlock) {
      const language = hljs.getLanguage(codeBlock.lang) ? codeBlock.lang : "plaintext"
      const highlighted = hljs.highlight(codeBlock.code, { language }).value
      return (
        <pre className="hljs my-1 overflow-x-auto rounded-md p-2 text-xs" {...props}>
          <code className={`language-${language}`} dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
      )
    }
    return <pre {...props}>{children}</pre>
  },
}

export function Markdown({ content }: { content: string }) {
  const rendered = useMemo(
    () => (
      <div className="markdown-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content}
        </ReactMarkdown>
      </div>
    ),
    [content],
  )
  return rendered
}
