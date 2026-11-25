<script lang="ts">
  import { vault, setup, unlock, recover, finishSetup } from './vault.svelte'

  let pw = $state('')
  let pw2 = $state('')
  let code = $state('')
  let busy = $state(false)
  let err = $state('')
  let mode = $state<'normal' | 'recover'>('normal')
  let recoveryCode = $state('')
  let saved = $state(false)

  async function doSetup(e: Event) {
    e.preventDefault()
    err = ''
    if (pw.length < 8) return (err = '비밀번호는 8자 이상으로 해주세요.')
    if (pw !== pw2) return (err = '두 비밀번호가 달라요.')
    busy = true
    recoveryCode = await setup(pw)
    busy = false
    pw = pw2 = ''
  }

  async function doUnlock(e: Event) {
    e.preventDefault()
    err = ''
    busy = true
    const ok = await unlock(pw)
    busy = false
    if (!ok) err = '비밀번호가 맞지 않아요.'
    pw = ''
  }

  async function doRecover(e: Event) {
    e.preventDefault()
    err = ''
    if (pw.length < 8) return (err = '새 비밀번호는 8자 이상으로 해주세요.')
    if (pw !== pw2) return (err = '두 비밀번호가 달라요.')
    busy = true
    const ok = await recover(code, pw)
    busy = false
    if (!ok) err = '복구 코드가 맞지 않아요.'
  }
</script>

<main class="wrap">
  <div class="card box">
    <svg class="logo" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="10" fill="var(--accent)"/><rect x="16" y="12" width="32" height="40" rx="2" fill="var(--paper)"/><path d="M22 22h20M22 29h20M22 36h13" stroke="var(--accent)" stroke-width="2.5"/><rect x="16" y="12" width="4" height="40" fill="var(--mark)"/></svg>
    <h1>만년 다이어리</h1>

    {#if recoveryCode}
      <p>복구 코드예요. 비밀번호를 잊었을 때 이 코드가 <b>유일한</b> 복구 수단이에요. 종이에 적거나 비밀번호 관리자에 보관하세요.</p>
      <div class="code" data-testid="recovery-code">{recoveryCode}</div>
      <label class="check"><input type="checkbox" bind:checked={saved} /> 안전한 곳에 적어두었어요</label>
      <button class="primary full" disabled={!saved} onclick={finishSetup}>시작하기</button>
    {:else if vault.status === 'setup'}
      <p class="muted">처음 오셨네요. 일기를 암호화할 비밀번호를 정해주세요. 이 비밀번호는 어디에도 전송되지 않아요.</p>
      <form onsubmit={doSetup}>
        <input type="password" placeholder="비밀번호 (8자 이상)" bind:value={pw} autocomplete="new-password" />
        <input type="password" placeholder="비밀번호 확인" bind:value={pw2} autocomplete="new-password" />
        {#if err}<p class="error">{err}</p>{/if}
        <button class="primary full" disabled={busy}>{busy ? '만드는 중…' : '다이어리 만들기'}</button>
      </form>
    {:else if mode === 'recover'}
      <p class="muted">복구 코드로 잠금을 풀고 새 비밀번호를 정해요.</p>
      <form onsubmit={doRecover}>
        <input type="text" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" bind:value={code} autocomplete="off" spellcheck="false" />
        <input type="password" placeholder="새 비밀번호" bind:value={pw} autocomplete="new-password" />
        <input type="password" placeholder="새 비밀번호 확인" bind:value={pw2} autocomplete="new-password" />
        {#if err}<p class="error">{err}</p>{/if}
        <button class="primary full" disabled={busy}>{busy ? '확인 중…' : '복구하기'}</button>
      </form>
      <button class="ghost full small" onclick={() => ((mode = 'normal'), (err = ''))}>돌아가기</button>
    {:else}
      <form onsubmit={doUnlock}>
        <!-- svelte-ignore a11y_autofocus -->
        <input type="password" placeholder="비밀번호" bind:value={pw} autocomplete="current-password" autofocus />
        {#if err}<p class="error">{err}</p>{/if}
        <button class="primary full" disabled={busy || !pw}>{busy ? '여는 중…' : '열기'}</button>
      </form>
      <button class="ghost full small muted" onclick={() => ((mode = 'recover'), (err = ''), (pw = ''))}>비밀번호를 잊었어요</button>
    {/if}
  </div>
  <p class="foot small muted">모든 기록은 이 기기 안에서 암호화되어 저장돼요.</p>
</main>

<style>
  .wrap { min-height: 100dvh; display: grid; place-content: center; padding: 1rem; }
  .box { width: min(380px, calc(100vw - 2rem)); padding: 2rem 1.5rem; text-align: center; }
  .logo { width: 48px; height: 48px; }
  h1 { margin: 0.5rem 0 1rem; font-family: var(--serif); font-size: 1.5rem; letter-spacing: 0.01em; }
  form { display: grid; gap: 0.6rem; margin-top: 1rem; }
  .full { width: 100%; margin-top: 0.4rem; }
  .code {
    font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
    font-size: 1.1rem; letter-spacing: 0.05em;
    background: var(--accent-soft); border-radius: var(--radius); padding: 0.8rem; margin: 1rem 0; user-select: all;
  }
  .check { display: flex; gap: 0.5rem; align-items: center; justify-content: center; margin-bottom: 0.5rem; }
  .foot { text-align: center; margin-top: 1rem; }
</style>
