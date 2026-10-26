import { useRef, type ReactNode } from 'react'
import { cn } from 'cn'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from './select'

export interface SelectFieldOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

export interface SelectFieldGroup {
  label: string
  options: SelectFieldOption[]
}

export interface SelectFieldProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  options?: readonly SelectFieldOption[]
  groups?: readonly SelectFieldGroup[]
  placeholder?: string
  disabled?: boolean
  ariaLabel?: string
  size?: 'sm' | 'default'
  /** 触发按钮的额外样式（高度、宽度、字号等） */
  className?: string
  /** 浮层内容额外样式（深色场景等） */
  contentClassName?: string
  /** 选项行额外样式 */
  itemClassName?: string
}

/**
 * 工具页统一的下拉选择：复用主应用 Radix Select 的绿底浮层与勾选态，
 * 避免原生 select 弹层被窗口裁切、样式失控。
 */
export function SelectField({
  value,
  defaultValue,
  onValueChange,
  options,
  groups,
  placeholder,
  disabled,
  ariaLabel,
  size = 'default',
  className,
  contentClassName,
  itemClassName,
}: SelectFieldProps) {
  // 鼠标关闭时不要把焦点还给触发器，否则 focus-visible 聚焦环会再次亮起；
  // 键盘操作仍然正常回焦。
  const pointerClose = useRef(false)

  return (
    <Select
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger
        size={size}
        aria-label={ariaLabel}
        className={cn('font-normal', className)}
        onPointerDown={() => {
          pointerClose.current = true
        }}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="start"
        sideOffset={4}
        collisionPadding={8}
        viewportClassName="scroll-thin"
        className={cn('w-[var(--radix-select-trigger-width)]', contentClassName)}
        onPointerDownCapture={() => {
          pointerClose.current = true
        }}
        onPointerDownOutside={() => {
          pointerClose.current = true
        }}
        onKeyDownCapture={() => {
          pointerClose.current = false
        }}
        onCloseAutoFocus={(event) => {
          if (pointerClose.current) event.preventDefault()
        }}
      >
        {groups
          ? groups.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.options.map((option) => (
                  <SelectOptionItem
                    key={option.value}
                    option={option}
                    className={itemClassName}
                  />
                ))}
              </SelectGroup>
            ))
          : (options ?? []).map((option) => (
              <SelectOptionItem
                key={option.value}
                option={option}
                className={itemClassName}
              />
            ))}
      </SelectContent>
    </Select>
  )
}

function SelectOptionItem({
  option,
  className,
}: {
  option: SelectFieldOption
  className?: string
}) {
  return (
    <SelectItem
      value={option.value}
      disabled={option.disabled}
      className={cn('text-[12.5px]', className)}
    >
      <span
        className="min-w-0 flex-1 truncate"
        title={typeof option.label === 'string' ? option.label : undefined}
      >
        {option.label}
      </span>
    </SelectItem>
  )
}
