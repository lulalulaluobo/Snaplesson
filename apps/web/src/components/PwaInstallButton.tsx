import { useState } from 'react'
import { usePwaInstall } from '@/lib/usePwaInstall'

export function PwaInstallButton() {
  const { status, triggerInstall } = usePwaInstall()
  const [showIosGuide, setShowIosGuide] = useState(false)
  const [showAndroidGuide, setShowAndroidGuide] = useState(false)

  // 已安装 or 不支持 → 不渲染任何东西
  if (status === 'installed' || status === 'unsupported') {
    return null
  }

  const handleButtonClick = () => {
    if (status === 'android-ready') {
      triggerInstall()
    } else if (status === 'ios-guide') {
      setShowIosGuide(true)
    } else if (status === 'mobile-fallback') {
      setShowAndroidGuide(true)
    }
  }

  return (
    <>
      {/* ── 安装按钮 ─────────────────────────────────── */}
      <button
        id="pwa-install-btn"
        type="button"
        onClick={handleButtonClick}
        className="
          flex items-center gap-1.5
          px-3 py-1.5
          rounded-full
          border border-[var(--accent)]
          text-[var(--accent)]
          text-xs font-semibold
          hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]
          transition shrink-0
          cursor-pointer
        "
        title="添加到手机桌面"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
        <span className="hidden sm:inline">添加到桌面</span>
        <span className="sm:hidden">安装</span>
      </button>

      {/* ── iOS 引导弹窗 ──────────────────────────────── */}
      {showIosGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowIosGuide(false)}
          role="dialog"
          aria-modal="true"
          aria-label="iOS 添加到桌面引导"
        >
          <div
            className="
              w-full max-w-sm
              rounded-2xl
              bg-[var(--bg)]
              border border-[var(--border-soft)]
              p-6
              shadow-2xl
            "
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] font-[var(--font-mono)] uppercase tracking-widest text-[var(--muted)] mb-1">
                  Add to Home Screen
                </p>
                <h2 className="font-[var(--font-display)] text-base font-bold leading-snug">
                  添加「一拍成课」到桌面
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="text-[var(--muted)] hover:text-[var(--fg)] transition text-lg leading-none ml-3 cursor-pointer"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>

            {/* Steps */}
            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-on)] text-xs font-bold">
                  1
                </span>
                <p className="text-sm text-[var(--fg-2)] leading-snug pt-0.5">
                  点击 Safari 底部工具栏的
                  <span className="inline-flex items-center gap-0.5 font-semibold text-[var(--accent)] mx-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                    分享
                  </span>
                  按钮
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-on)] text-xs font-bold">
                  2
                </span>
                <p className="text-sm text-[var(--fg-2)] leading-snug pt-0.5">
                  在菜单中向下滑动，点击
                  <span className="font-semibold text-[var(--fg)] mx-1">「添加到主屏幕」</span>
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-on)] text-xs font-bold">
                  3
                </span>
                <p className="text-sm text-[var(--fg-2)] leading-snug pt-0.5">
                  点击右上角
                  <span className="font-semibold text-[var(--fg)] mx-1">「添加」</span>
                  即完成安装
                </p>
              </li>
            </ol>

            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="
                mt-5 w-full
                py-2.5
                rounded-[var(--radius-md)]
                bg-[var(--surface-warm)]
                border border-[var(--border-soft)]
                text-sm font-semibold text-[var(--fg-2)]
                hover:bg-[var(--surface)]
                transition cursor-pointer
              "
            >
              知道了
            </button>
          </div>

          {/* Arrow indicator for bottom tab */}
          <div className="absolute bottom-[18px] left-1/2 -translate-x-1/2">
            <div className="w-6 h-6 rotate-45 bg-[var(--bg)] border-r border-b border-[var(--border-soft)] shadow-md" />
          </div>
        </div>
      )}

      {/* ── Android / General Mobile 手动添加引导弹窗 ── */}
      {showAndroidGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowAndroidGuide(false)}
          role="dialog"
          aria-modal="true"
          aria-label="安卓添加到桌面引导"
        >
          <div
            className="
              w-full max-w-sm
              rounded-2xl
              bg-[var(--bg)]
              border border-[var(--border-soft)]
              p-6
              shadow-2xl
            "
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] font-[var(--font-mono)] uppercase tracking-widest text-[var(--muted)] mb-1">
                  Add to Home Screen
                </p>
                <h2 className="font-[var(--font-display)] text-base font-bold leading-snug">
                  添加「一拍成课」到桌面
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAndroidGuide(false)}
                className="text-[var(--muted)] hover:text-[var(--fg)] transition text-lg leading-none ml-3 cursor-pointer"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>

            {/* Steps */}
            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-on)] text-xs font-bold">
                  1
                </span>
                <p className="text-sm text-[var(--fg-2)] leading-snug pt-0.5">
                  点击浏览器右上角的
                  <span className="font-semibold text-[var(--fg)] mx-1">菜单按钮</span>
                  （通常是三个点
                  <span className="font-bold text-[var(--accent)] mx-0.5">⋮</span>）
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-on)] text-xs font-bold">
                  2
                </span>
                <p className="text-sm text-[var(--fg-2)] leading-snug pt-0.5">
                  在下拉菜单中找到并点击
                  <span className="font-semibold text-[var(--fg)] mx-1">「添加到主屏幕」</span>
                  或
                  <span className="font-semibold text-[var(--fg)] mx-1">「安装应用」</span>
                </p>
              </li>
            </ol>

            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowAndroidGuide(false)}
              className="
                mt-5 w-full
                py-2.5
                rounded-[var(--radius-md)]
                bg-[var(--surface-warm)]
                border border-[var(--border-soft)]
                text-sm font-semibold text-[var(--fg-2)]
                hover:bg-[var(--surface)]
                transition cursor-pointer
              "
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </>
  )
}
