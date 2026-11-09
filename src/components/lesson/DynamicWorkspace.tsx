'use client'

import { resolveWorkspace } from './workspaces'
import type { DynamicWorkspaceProps } from './types'

/**
 * The dynamic workspace slot of the lesson shell.
 *
 * It resolves the manipulative for the current problem from the registry and
 * renders it. The workspace is keyed by the problem id, so switching problem
 * remounts the component and every workspace starts from a clean state.
 */
export function DynamicWorkspace(props: DynamicWorkspaceProps) {
  const { problem, theme, langMode } = props

  const definition = resolveWorkspace(problem.workspaceType)

  if (!definition) {
    return (
      <div
        className={`flex-1 min-h-[210px] border-2 border-dashed p-5 flex flex-col items-center justify-center gap-2 text-center ${theme.surface} ${theme.surfaceBorder} ${theme.radius}`}
      >
        <span className="text-3xl" aria-hidden="true">
          🧰
        </span>
        <p className={`text-sm font-bold ${theme.text}`}>ยังไม่มีเครื่องมือสำหรับโจทย์นี้</p>
        <p className={`text-xs ${theme.textMuted}`}>
          ลองตอบคำถามด้านล่างได้เลยนะ — เครื่องมือจะมาพร้อมกับโจทย์รุ่นถัดไป
        </p>
      </div>
    )
  }

  const WorkspaceComponent = definition.Component

  return (
    <WorkspaceComponent
      key={problem.id}
      problem={problem}
      tier={problem.tier}
      langMode={langMode}
      theme={theme}
      problemId={problem.id}
    />
  )
}
