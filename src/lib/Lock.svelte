<script lang="ts">
  import { vault, setup, unlock, recover, wipeEverything } from './vault.svelte'
  import { deleteRemoteBackup } from './drive-sync.svelte'
  import PwInput from './PwInput.svelte'

  let pw = $state('')
  let pw2 = $state('')
  let code = $state('')
  let busy = $state(false)
  let err = $state('')
  let mode = $state<'normal' | 'recover'>('normal')

  let resetText = $state('')
  let resetRemoteToo = $state(false)
  let resetBusy = $state(false)
  let resetErr = $state('')

  async function doReset() {
    if (resetText !== '초기화') return
    resetBusy = true
    resetErr = ''
    if (resetRemoteToo) {
      try {
        await deleteRemoteBackup()
      } catch (e) {
        resetErr = `Drive 백업 삭제는 실패했지만, 이 기기는 계속 초기화할게요: ${e instanceof Error ? e.message : String(e)}`
      }
    }
    await wipeEverything()
    resetBusy = false
  }

  async function doSetup(e: Event) {
    e.preventDefault()
    err = ''
    if (pw.length < 8) return (err = '비밀번호는 8자 이상으로 해주세요.')
    if (pw !== pw2) return (err = '두 비밀번호가 달라요.')
    busy = true
    await setup(pw)
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

    {#if vault.status === 'setup'}
      <p class="muted">처음 오셨네요. 일기를 암호화할 비밀번호를 정해주세요. 이 비밀번호는 어디에도 전송되지 않아요.</p>
      <p class="muted small">비밀번호를 잊었을 때를 대비한 복구 코드는, 들어가신 뒤 설정에서 언제든 받을 수 있어요.</p>
      <form onsubmit={doSetup}>
        <PwInput placeholder="비밀번호 (8자 이상)" bind:value={pw} autocomplete="new-password" />
        <PwInput placeholder="비밀번호 확인" bind:value={pw2} autocomplete="new-password" />
        {#if err}<p class="error">{err}</p>{/if}
        <button class="primary full" disabled={busy}>{busy ? '만드는 중…' : '다이어리 만들기'}</button>
      </form>
    {:else if mode === 'recover'}
      <p class="muted">복구 코드로 잠금을 풀고 새 비밀번호를 정해요.</p>
      <form onsubmit={doRecover}>
        <input type="text" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" bind:value={code} autocomplete="off" spellcheck="false" />
        <PwInput placeholder="새 비밀번호" bind:value={pw} autocomplete="new-password" />
        <PwInput placeholder="새 비밀번호 확인" bind:value={pw2} autocomplete="new-password" />
        {#if err}<p class="error">{err}</p>{/if}
        <button class="primary full" disabled={busy}>{busy ? '확인 중…' : '복구하기'}</button>
      </form>
      <button class="ghost full small" onclick={() => ((mode = 'normal'), (err = ''))}>돌아가기</button>
    {:else}
      <form onsubmit={doUnlock}>
        <PwInput placeholder="비밀번호" bind:value={pw} autocomplete="current-password" autofocus />
        {#if err}<p class="error">{err}</p>{/if}
        <button class="primary full" disabled={busy || !pw}>{busy ? '여는 중…' : '열기'}</button>
      </form>
      <button class="ghost full small muted" onclick={() => ((mode = 'recover'), (err = ''), (pw = ''))}>비밀번호를 잊었어요</button>
      <details class="reset">
        <summary class="muted small">이 기기를 처음부터 다시 시작할래요</summary>
        <p class="muted small">이 기기에 저장된 암호화된 기록을 전부 지우고 새로 시작해요. 되돌릴 수 없어요.</p>
        <label class="check small"><input type="checkbox" bind:checked={resetRemoteToo} /> Google Drive에 올라가 있는 백업도 함께 삭제</label>
        <div class="resetRow">
          <input type="text" bind:value={resetText} placeholder="초기화" />
          <button class="danger" disabled={resetText !== '초기화' || resetBusy} onclick={doReset}>{resetBusy ? '처리 중…' : '초기화'}</button>
        </div>
        {#if resetErr}<p class="error small">{resetErr}</p>{/if}
      </details>
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
  .check { display: flex; gap: 0.5rem; align-items: center; justify-content: center; margin-bottom: 0.5rem; }
  .foot { text-align: center; margin-top: 1rem; }
  .reset { text-align: left; margin-top: 0.8rem; }
  .reset summary { text-align: center; cursor: pointer; }
  .reset .check { justify-content: flex-start; margin-top: 0.5rem; }
  .resetRow { display: flex; gap: 0.4rem; margin-top: 0.4rem; }
  .resetRow input { flex: 1; }
</style>
