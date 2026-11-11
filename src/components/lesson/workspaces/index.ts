'use client'

import { createElement } from 'react'
import type { ComponentType, ReactElement } from 'react'
import type { WorkspaceProps, WorkspaceType } from '../types'
import { Base10Workspace } from './Base10Workspace'
import { BarModelWorkspace } from './BarModelWorkspace'
import { FractionWorkspace } from './FractionWorkspace'
import { ClockWorkspace } from './ClockWorkspace'
import { PlaceValueWorkspace } from './PlaceValueWorkspace'

/**
 * The workspace registry.
 *
 * The lesson shell never imports a workspace directly - it asks the registry
 * for the component that matches the problem's `workspaceType`. Adding a new
 * manipulative means adding one entry here.
 */

export interface WorkspaceDefinition {
  type: WorkspaceType
  label: string
  labelTH: string
  Component: ComponentType<WorkspaceProps>
}

/**
 * Placeholder for problems that need no manipulative at all.
 *
 * It keeps the stage calm instead of showing an empty grey box.
 */
function NoWorkspace(props: WorkspaceProps): ReactElement {
  const { theme } = props
  return createElement(
    'div',
    {
      className: `flex-1 min-h-[210px] border-2 border-dashed p-5 flex flex-col items-center justify-center gap-2 text-center ${theme.surface} ${theme.surfaceBorder} ${theme.radius}`,
    },
    createElement('span', { className: 'text-3xl', 'aria-hidden': true }, '🧩'),
    createElement(
      'p',
      { className: `text-sm font-bold ${theme.text}` },
      'โจทย์นี้ไม่ต้องใช้เครื่องมือโต้ตอบ',
    ),
    createElement(
      'p',
      { className: `text-xs ${theme.textMuted}` },
      'อ่านโจทย์แล้วเลือกคำตอบที่ถูกต้องด้านล่างได้เลยค่ะ',
    ),
  )
}

export const WORKSPACE_REGISTRY: Record<WorkspaceType, WorkspaceDefinition> = {
  base10: {
    type: 'base10',
    label: 'Base-10 Blocks',
    labelTH: 'กระดานบล็อกฐานสิบ',
    Component: Base10Workspace,
  },
  barModel: {
    type: 'barModel',
    label: 'Bar Model',
    labelTH: 'เครื่องมือสร้างบาร์โมเดล',
    Component: BarModelWorkspace,
  },
  fraction: {
    type: 'fraction',
    label: 'Fraction Circle',
    labelTH: 'เครื่องมือสร้างเศษ',
    Component: FractionWorkspace,
  },
  clock: {
    type: 'clock',
    label: 'Analogue Clock',
    labelTH: 'เครื่องมืออ่านเวลา',
    Component: ClockWorkspace,
  },
  placeValue: {
    type: 'placeValue',
    label: 'Place Value Chart',
    labelTH: 'กระดานค่าตำแหน่ง',
    Component: PlaceValueWorkspace,
  },
  none: {
    type: 'none',
    label: 'No Manipulative',
    labelTH: 'ไม่ใช้เครื่องมือ',
    Component: NoWorkspace,
  },
}

/**
 * Look up a workspace by type.
 *
 * Returns `null` for an unknown type so the caller can render a calm empty
 * state instead of crashing on content coming from the API.
 */
export function resolveWorkspace(type: WorkspaceType): WorkspaceDefinition | null {
  if (!Object.prototype.hasOwnProperty.call(WORKSPACE_REGISTRY, type)) return null
  return WORKSPACE_REGISTRY[type] ?? null
}
