import * as Dialog from '@radix-ui/react-dialog'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'
import { X } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: Array<string | false | null | undefined>) {
  return twMerge(clsx(inputs))
}

const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-bold transition active:translate-y-px disabled:pointer-events-none disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400',
  {
    variants: {
      variant: {
        gold: 'bg-gradient-to-b from-gold-200 to-gold-400 text-ink shadow-[0_8px_0_#8a5a10] hover:brightness-105',
        crimson: 'bg-gradient-to-b from-[#e85b63] to-crimson text-white shadow-[0_8px_0_#6d1018] hover:brightness-105',
        ghost: 'bg-white/10 text-white border border-white/20 hover:bg-white/15',
        ink: 'bg-[#2a160f] text-[#f6e7c1] border border-[#e6c15a]/40 hover:bg-[#3a2014]',
      },
      size: {
        md: 'h-11 px-5 text-sm',
        lg: 'h-14 px-6 text-base',
        sm: 'h-9 px-3 text-xs',
      },
    },
    defaultVariants: { variant: 'gold', size: 'md' },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonStyles> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant, size, asChild, ...props }, ref) {
  const Comp = asChild ? Slot : 'button'
  return <Comp ref={ref} className={cn(buttonStyles({ variant, size }), className)} {...props} />
})

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-12 w-full rounded-2xl border border-[#e6c15a]/40 bg-[#1a0d0a]/80 px-4 text-white outline-none placeholder:text-white/40 focus:border-gold-400',
        className,
      )}
      {...props}
    />
  )
})

export function RulesDialog({ trigger }: { trigger: ReactNode }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[86vh] w-[min(640px,calc(100%-24px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-[#e6c15a]/40 bg-[#24140f] p-6 text-[#f6ead2] shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-4">
            <Dialog.Title className="font-display text-3xl text-gold-200">달빛맞고 규칙</Dialog.Title>
            <Dialog.Close className="rounded-full p-2 text-white/70 hover:bg-white/10" aria-label="닫기">
              <X />
            </Dialog.Close>
          </div>
          <div className="space-y-4 text-sm leading-6 text-[#f3e6cf]/90">
            <p>화투 48장에 쌍피·쓰리피 보너스패를 더한 50장으로 둘을 칩니다. 각자 10장, 바닥 8장, 나머지는 더미입니다.</p>
            <p>같은 달끼리만 먹습니다. 바닥이 한 장이면 가져가고, 두 장이면 하나를 고르고, 세 장이면 네 장을 한꺼번에 먹고 상대 피 1장을 가져옵니다.</p>
            <p>바닥에 없는 달을 냈는데 뒤집은 패가 같은 달이면 쪽입니다. 한 장을 맞춰 냈는데 뒤집힌 패까지 같으면 뻑으로 세 장이 묶입니다. 바닥의 두 장에 내고 뒤집힌 패도 같으면 따닥입니다.</p>
            <p>남이 싼 뻑을 먹으면 피 1장, 내가 싼 뻑을 내가 먹으면 자뻑으로 피 2장입니다. 뻑이 세 번 이어지면 그 사람이 바로 이깁니다. 바닥을 비우면 쓸이고, 마지막 턴은 빼 줍니다.</p>
            <p>같은 달 세 장을 흔들면 승점이 두 배가 되고, 두 번 흔들면 네 배입니다. 바닥의 한 장 위에 세 장을 던지는 폭탄도 피 1장과 두 배, 그리고 빈 패 두 장입니다. 처음에 같은 달 네 장이면 총통으로 10점을 받을 수 있습니다.</p>
            <p>7점부터 고 또는 스톱입니다. 1고 +1, 2고 +2, 3고부터는 +점수와 함께 2·4·8·16배로 커집니다. 국진은 열끗으로도, 쌍피로도 계산할 수 있습니다.</p>
            <p>피박, 광박, 멍박, 고박과 미션, 흔들기, 폭탄, 나가리가 모두 배수로 겹칩니다. 점수에 점당 금액을 곱한 돈이 오갑니다.</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
