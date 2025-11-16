import React, { useMemo, useRef } from "react"
import { motion, useInView, UseInViewOptions } from "motion/react"

import { cn } from "@/lib/utils"

interface ShimmeringTextProps {
  /** Text to display with shimmer effect */
  text: string
  /** Animation duration in seconds */
  duration?: number
  /** Delay before starting animation */
  delay?: number
  /** Whether to repeat the animation */
  repeat?: boolean
  /** Pause duration between repeats in seconds */
  repeatDelay?: number
  /** Custom className */
  className?: string
  /** Whether to start animation when component enters viewport */
  startOnView?: boolean
  /** Whether to animate only once */
  once?: boolean
  /** Margin for in-view detection (rootMargin) */
  inViewMargin?: UseInViewOptions["margin"]
  /** Shimmer spread multiplier */
  spread?: number
  /** Base text color */
  color?: string
  /** Shimmer gradient color */
  shimmerColor?: string
}

export function ShimmeringText({
  text,
  duration = 2,
  delay = 0,
  repeat = true,
  repeatDelay = 0.5,
  className,
  startOnView = true,
  once = false,
  inViewMargin,
  spread = 2,
  color,
  shimmerColor,
}: ShimmeringTextProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once, margin: inViewMargin })

  // Calculate dynamic spread based on text length
  const dynamicSpread = useMemo(() => {
    return text.length * spread
  }, [text, spread])

  // Determine if we should start animation
  const shouldAnimate = !startOnView || isInView

  const baseColor = color || "var(--muted-foreground)"
  const shimmerColorValue = shimmerColor || "var(--foreground)"
  
  const shimmerGradient = `linear-gradient(90deg, transparent calc(50% - ${dynamicSpread}px), ${shimmerColorValue}, transparent calc(50% + ${dynamicSpread}px))`
  const baseGradient = `linear-gradient(${baseColor}, ${baseColor})`

  return (
    <motion.span
      ref={ref}
      className={cn(
        "relative inline-block bg-clip-text text-transparent",
        className
      )}
      style={
        {
          backgroundImage: `${shimmerGradient}, ${baseGradient}`,
          backgroundSize: "250% 100%, auto",
          backgroundRepeat: "no-repeat, padding-box",
        } as React.CSSProperties
      }
      initial={{
        backgroundPosition: "100% center",
        opacity: 0,
      }}
      animate={
        shouldAnimate
          ? {
              backgroundPosition: "0% center",
              opacity: 1,
            }
          : {}
      }
      transition={{
        backgroundPosition: {
          repeat: repeat ? Infinity : 0,
          duration,
          delay,
          repeatDelay,
          ease: "linear",
        },
        opacity: {
          duration: 0.3,
          delay,
        },
      }}
    >
      {text}
    </motion.span>
  )
}
