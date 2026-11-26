<script lang="ts">
  import { onMount } from 'svelte'
  import { vault, init, lock } from './lib/vault.svelte'
  import { todayKey } from './lib/dates'
  import Lock from './lib/Lock.svelte'
  import Diary from './lib/Diary.svelte'
  import Search from './lib/Search.svelte'
  import Settings from './lib/Settings.svelte'
  import Calendar from './lib/Calendar.svelte'
  import Icon from './lib/Icon.svelte'
  import { prefs } from './lib/prefs.svelte'
  import { applyTheme } from './lib/theme'
  import { autoSyncIfConnected } from './lib/drive-sync.svelte'
  import { gate, initGate, renderSignInButton, setKeepSignedIn } from './lib/access-gate.svelte'

  // runs regardless of lock state, so the lock screen also reflects the chosen theme
  $effect(() => {
    applyTheme(prefs.themeMode, prefs.customColors)
  })

  // the app opens on the month calendar; picking a day opens the entry page
  let tab = $state<'calendar' | 'diary' | 'search' | 'settings'>('calendar')
  let date = $state(todayKey())
  let month = $state(todayKey().slice(0, 7))
  let autoLock = $state(Number(localStorage.getItem('autoLock') || 5))
  $effect(() => localStorage.setItem('autoLock', String(autoLock)))

  onMount(() => {
    init()
    initGate()
  })

  let gateBtnEl = $state<HTMLDivElement>()
  $effect(() => {
    if (gate.status === 'signed_out' && gateBtnEl) renderSignInButton(gateBtnEl)
  })

  // auto-lock after inactivity, and when the app has been in the background too long
  let last = Date.now()
  let hiddenAt = 0
  const touch = () => (last = Date.now())
  $effect(() => {
    if (vault.status !== 'unlocked') return
    const ms = autoLock * 60_000
    last = Date.now()
    const t = setInterval(() => {
      if (Date.now() - last > ms) lock()
    }, 10_000)
    const vis = () => {
      if (document.hidden) hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > ms) lock()
    }
    document.addEventListener('visibilitychange', vis)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', vis)
    }
  })

  // when a new day starts while the app is open, follow it if we were on "today"
  let lastToday = todayKey()
  $effect(() => {
    const t = setInterval(() => {
      const now = todayKey()
      if (now !== lastToday) {
        if (date === lastToday) date = now
        lastToday = now
      }
    }, 60_000)
    return () => clearInterval(t)
  })

  function pick(d: string) {
    date = d
    tab = 'diary'
    scrollTo(0, 0)
  }

  function backToCalendar() {
    month = date.slice(0, 7)
    tab = 'calendar'
  }

  // after locking, start again from the calendar
  $effect(() => {
    if (vault.status === 'locked') tab = 'calendar'
  })

  // if Drive sync was turned on before, sync quietly each time the diary is unlocked
  $effect(() => {
    if (vault.status === 'unlocked') autoSyncIfConnected()
  })
</script>

<svelte:window onpointerdown={touch} onkeydown={touch} />

{#if gate.status === 'checking'}
  <div></div>
{:else if gate.status !== 'approved'}
  <div class="gate">
    <div class="card">
      <span class="icon">📔</span>
      <h1>만년 다이어리</h1>
      {#if gate.status === 'denied'}
        <p class="deny">{gate.email || '이 계정'}은(는) 허용되지 않았어요. 관리자에게 문의해주세요.</p>
      {:else}
        <p>초대받은 사람만 사용할 수 있어요. Google 계정으로 로그인해서 확인해주세요.</p>
        <label class="keep">
          <input type="checkbox" checked={gate.keepSignedIn} onchange={(e) => setKeepSignedIn(e.currentTarget.checked)} />
          이 기기에서 로그인 상태 유지
        </label>
      {/if}
      <div bind:this={gateBtnEl}></div>
    </div>
  </div>
{:else if vault.status === 'loading'}
  <div></div>
{:else if vault.status !== 'unlocked'}
  <Lock />
{:else}
  <div class="shell">
    <header class="top">
      <span class="brand">만년 다이어리</span>
      <nav class="tabs">
        <button class={['tab', (tab === 'calendar' || tab === 'diary') && 'on']} onclick={() => (tab === 'diary' ? backToCalendar() : (tab = 'calendar'))}><span class="ic"><Icon name="calendar" /></span><span>달력</span></button>
        <button class={['tab', tab === 'search' && 'on']} onclick={() => (tab = 'search')}><span class="ic"><Icon name="search" /></span><span>검색</span></button>
        <button class={['tab', tab === 'settings' && 'on']} onclick={() => (tab = 'settings')}><span class="ic"><Icon name="settings" /></span><span>설정</span></button>
        <button class="tab lockbtn" onclick={lock} title="잠그기"><span class="ic"><Icon name="lock" /></span><span>잠금</span></button>
      </nav>
    </header>
    <main>
      {#if tab === 'calendar'}
        <Calendar bind:month onpick={pick} />
      {:else if tab === 'diary'}
        <Diary bind:date onback={backToCalendar} />
      {:else if tab === 'search'}
        <Search onpick={pick} />
      {:else}
        <Settings bind:autoLock />
      {/if}
    </main>
  </div>
{/if}

<style>
  .gate { max-width: 360px; margin: 18vh auto 0; padding: 0 16px; text-align: center; }
  .gate .card { background: var(--paper); border: 1px solid var(--line); border-radius: 16px; padding: 2rem 1.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.9rem; }
  .gate .icon { font-size: 2rem; }
  .gate h1 { font-family: var(--serif); font-size: 1.2rem; margin: 0; }
  .gate p { color: var(--muted); font-size: 0.92rem; line-height: 1.5; margin: 0; }
  .gate .deny { color: var(--danger); }
  .gate .keep { display: flex; align-items: center; gap: 0.45rem; font-size: 0.85rem; color: var(--muted); cursor: pointer; }

  .shell { max-width: 880px; margin: 0 auto; padding: 0 16px calc(88px + env(safe-area-inset-bottom)); }
  .top { display: flex; justify-content: space-between; align-items: center; padding: calc(0.8rem + env(safe-area-inset-top)) 0 0.7rem; border-bottom: 1px solid var(--line); margin-bottom: 0.9rem; }
  .brand { font-family: var(--serif); font-weight: 700; font-size: 1.1rem; letter-spacing: 0.02em; }
  .tabs { display: flex; gap: 0.25rem; }
  .tab { border-color: transparent; background: transparent; display: flex; gap: 0.35rem; align-items: center; color: var(--muted); padding: 0.4rem 0.7rem; }
  .tab.on { color: var(--accent); background: var(--accent-soft); font-weight: 600; }
  .ic { display: inline-flex; }
  main { padding-top: 0.4rem; }
  @media (max-width: 640px) {
    .top { justify-content: center; }
    .brand { display: none; }
    .tabs {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 10;
      background: var(--paper); border-top: 1px solid var(--line);
      justify-content: space-around; padding: 0.3rem 0 calc(0.3rem + env(safe-area-inset-bottom));
    }
    .tab { flex-direction: column; gap: 0; font-size: 0.75rem; padding: 0.3rem 1rem; }
    .tab .ic { font-size: 1.3rem; }
    .tab.on { background: transparent; }
    .top { padding: env(safe-area-inset-top) 0 0; border-bottom: none; margin-bottom: 0.4rem; }
  }
</style>
