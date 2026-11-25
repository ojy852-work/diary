<script lang="ts">
  import { entries, exportBackup, importBackup, importPlain, exportMarkdown, changePassword, wipeEverything, lock, type BackupFile } from './vault.svelte'
  import { todayKey, yearOf } from './dates'
  import { prefs, setPref, setCustomColor } from './prefs.svelte'
  import { DEFAULT_CUSTOM_COLORS, type ThemeMode } from './theme'
  import PwInput from './PwInput.svelte'
  import { driveSync, connect as connectDrive, disconnect as disconnectDrive, syncNow as driveSyncNow } from './drive-sync.svelte'

  const THEME_OPTIONS: { v: ThemeMode; label: string }[] = [
    { v: 'system', label: '시스템 설정' },
    { v: 'light', label: '라이트' },
    { v: 'dark', label: '다크' },
    { v: 'custom', label: '사용자 지정' },
  ]
  const COLOR_FIELDS: { k: keyof typeof DEFAULT_CUSTOM_COLORS; label: string }[] = [
    { k: 'bg', label: '배경' },
    { k: 'paper', label: '카드·작성 칸' },
    { k: 'ink', label: '글자' },
    { k: 'accent', label: '포인트' },
  ]
  function resetColors() {
    for (const { k } of COLOR_FIELDS) setCustomColor(k, DEFAULT_CUSTOM_COLORS[k])
  }

  let { autoLock = $bindable() }: { autoLock: number } = $props()

  let msg = $state('')
  let err = $state('')
  let backupFile = $state<BackupFile | null>(null)
  let backupPw = $state('')
  let oldPw = $state('')
  let newPw = $state('')
  let newPw2 = $state('')
  let wipeText = $state('')

  const stats = $derived.by(() => {
    const ks = [...entries.keys()]
    const ys = new Set(ks.map(yearOf))
    const chars = [...entries.values()].reduce((n, e) => n + e.text.length, 0)
    return { days: ks.length, years: ys.size, first: ks.sort()[0], chars }
  })

  function download(name: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }))
    const a = Object.assign(document.createElement('a'), { href: url, download: name })
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function note(m: string, isErr = false) {
    msg = isErr ? '' : m
    err = isErr ? m : ''
  }

  async function doBackup() {
    download(`만년다이어리-백업-${todayKey()}.mdiary`, JSON.stringify(await exportBackup()), 'application/json')
    localStorage.setItem('lastBackup', String(Date.now()))
    note('암호화된 백업 파일을 저장했어요. 이 파일은 비밀번호 없이는 열 수 없어요.')
  }

  async function pickBackup(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const f = input.files?.[0]
    input.value = ''
    if (!f) return
    try {
      const data = JSON.parse(await f.text())
      if (data?.format !== 'mannyeon-backup') throw 0
      backupFile = data
      note('')
    } catch {
      note('만년 다이어리 백업 파일이 아니에요.', true)
    }
  }

  async function doRestore(e: Event) {
    e.preventDefault()
    if (!backupFile) return
    const r = await importBackup(backupFile, backupPw)
    if (!r) return note('백업을 만들 때의 비밀번호가 맞지 않아요.', true)
    backupFile = null
    backupPw = ''
    note(`가져오기 완료: 새 기록 ${r.added}개, 갱신 ${r.updated}개. 같은 날짜는 더 최근에 고친 쪽을 남겼어요.`)
  }

  async function pickPlain(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const f = input.files?.[0]
    input.value = ''
    if (!f) return
    try {
      const n = await importPlain(await f.text())
      note(n ? `${n}일치 기록을 가져왔어요.` : '가져올 날짜 형식의 기록을 찾지 못했어요.', !n)
    } catch {
      note('파일을 읽지 못했어요.', true)
    }
  }

  function doMarkdown() {
    if (!confirm('암호화되지 않은 텍스트 파일로 저장돼요. 보관에 주의하세요. 계속할까요?')) return
    download(`만년다이어리-${todayKey()}.md`, exportMarkdown(), 'text/markdown')
  }

  async function doChangePw(e: Event) {
    e.preventDefault()
    if (newPw.length < 8) return note('새 비밀번호는 8자 이상으로 해주세요.', true)
    if (newPw !== newPw2) return note('새 비밀번호 두 개가 달라요.', true)
    if (!(await changePassword(oldPw, newPw))) return note('지금 비밀번호가 맞지 않아요.', true)
    oldPw = newPw = newPw2 = ''
    note('비밀번호를 바꿨어요. 복구 코드는 그대로 쓸 수 있어요.')
  }

  async function doWipe() {
    if (wipeText !== '모두 삭제') return
    await wipeEverything()
  }

  const lastBackup = Number(localStorage.getItem('lastBackup') || 0)
  const backupAge = lastBackup ? Math.floor((Date.now() - lastBackup) / 86400000) : null
</script>

{#if msg}<p class="ok">{msg}</p>{/if}
{#if err}<p class="error">{err}</p>{/if}

<section class="card">
  <h2>기록 현황</h2>
  <p>
    <b>{stats.days}</b>일의 기록, <b>{stats.years}</b>개 연도에 걸쳐 있어요.
    {#if stats.first}<br /><span class="muted small">가장 오래된 기록 {stats.first} · 총 {stats.chars.toLocaleString()}자</span>{/if}
  </p>
</section>

<section class="card">
  <h2>백업</h2>
  <p class="muted small">
    {backupAge === null ? '아직 백업한 적이 없어요.' : backupAge === 0 ? '오늘 백업했어요.' : `마지막 백업: ${backupAge}일 전`}
    브라우저 데이터를 지우거나 기기를 바꾸면 기록이 사라질 수 있어요. 자주 백업해 주세요.
  </p>
  <div class="row">
    <button class="primary" onclick={doBackup}>암호화 백업 저장</button>
    <label class="filebtn"><input type="file" accept=".mdiary,application/json" onchange={pickBackup} />백업에서 가져오기</label>
  </div>
  {#if backupFile}
    <form onsubmit={doRestore} class="stack">
      <p class="small">백업 파일의 기록 {backupFile.entries.filter((e) => !e.deleted).length}개. 백업을 만들 때의 비밀번호를 입력하세요.</p>
      <PwInput bind:value={backupPw} placeholder="백업 비밀번호" />
      <div class="row"><button class="primary">합치기</button><button type="button" onclick={() => (backupFile = null)}>취소</button></div>
    </form>
  {/if}
  <p class="muted small">기기 간 자동 동기화는 아래 "Google Drive 동기화"에서 설정할 수 있어요.</p>
</section>

<section class="card">
  <h2>Google Drive 동기화</h2>
  {#if !driveSync.configured}
    <p class="muted small">아직 준비 중이에요. Google Cloud Console에서 OAuth 클라이언트 ID를 만들어야 켤 수 있어요.</p>
  {:else if driveSync.status === 'disconnected'}
    <p class="muted small">Google 계정에 연결하면 이 기록을 다른 기기와 맞출 수 있어요. 지금처럼 암호화된 채로만 올라가고, 비밀번호는 전송되지 않아요.</p>
    <button class="primary" onclick={connectDrive}>Google 계정 연결</button>
  {:else}
    <p class="muted small">
      {#if driveSync.status === 'connecting'}연결하는 중…
      {:else if driveSync.status === 'syncing'}동기화하는 중…
      {:else if driveSync.status === 'error'}문제가 있었어요: {driveSync.error}
      {:else}연결됨{/if}
      {#if driveSync.lastSynced}<br />마지막 동기화: {new Date(driveSync.lastSynced).toLocaleString('ko-KR')}{/if}
    </p>
    <div class="row">
      <button onclick={driveSyncNow} disabled={driveSync.status === 'syncing' || driveSync.status === 'connecting'}>지금 동기화</button>
      <button class="ghost" onclick={disconnectDrive}>연결 해제</button>
    </div>
  {/if}
</section>

<section class="card">
  <h2>옛 일기 가져오기 · 내보내기</h2>
  <p class="muted small">
    텍스트(.md, .txt)에서 날짜 줄(<code>## 2015-03-01</code>, <code>2015.03.01</code>, <code>2015년 3월 1일</code>) 아래 내용을 그 날의 기록으로 가져와요.
    JSON 배열(<code>{'[{"date":"2015-03-01","text":"..."}]'}</code>)도 돼요. 이미 있는 날은 덮어쓰지 않고 뒤에 이어 붙여요.
  </p>
  <div class="row">
    <label class="filebtn"><input type="file" accept=".md,.txt,.json,text/*,application/json" onchange={pickPlain} />텍스트 가져오기</label>
    <button onclick={doMarkdown}>Markdown으로 내보내기</button>
  </div>
</section>

<section class="card">
  <h2>테마</h2>
  <p class="muted small">화면 배색을 직접 정할 수 있어요. 기본은 기기의 시스템 설정(라이트·다크)을 따라가요.</p>
  <div class="seg" role="radiogroup" aria-label="테마">
    {#each THEME_OPTIONS as o}
      <button role="radio" aria-checked={prefs.themeMode === o.v} class={['segb', prefs.themeMode === o.v && 'on']} onclick={() => setPref('themeMode', o.v)}>{o.label}</button>
    {/each}
  </div>
  {#if prefs.themeMode === 'custom'}
    <div class="colors">
      {#each COLOR_FIELDS as f}
        <label class="colorpick">
          <input type="color" value={prefs.customColors[f.k]} oninput={(e) => setCustomColor(f.k, e.currentTarget.value)} />
          <span>{f.label}</span>
        </label>
      {/each}
    </div>
    <button class="small" onclick={resetColors}>기본값으로</button>
  {/if}
</section>

<section class="card">
  <h2>손글씨 (펜 입력)</h2>
  <p class="muted small">태블릿 펜(Apple Pencil, S Pen, Windows 펜)으로 일기를 쓸 수 있어요. 필압을 인식하고, 손글씨도 글과 똑같이 암호화되어 저장·백업돼요. 아직 시험 단계예요.</p>
  <label class="check"><input type="checkbox" checked={prefs.ink} onchange={(e) => setPref('ink', e.currentTarget.checked)} /> 작성 화면에 손글씨 입력 켜기</label>
  <label class="check"><input type="checkbox" checked={prefs.penOnly} disabled={!prefs.ink} onchange={(e) => setPref('penOnly', e.currentTarget.checked)} /> 펜으로만 쓰기 (손바닥·손가락 터치 무시)</label>
</section>

<section class="card">
  <h2>보안</h2>
  <label class="inline">
    자동 잠금
    <select bind:value={autoLock}>
      <option value={1}>1분</option>
      <option value={3}>3분</option>
      <option value={5}>5분</option>
      <option value={15}>15분</option>
      <option value={60}>1시간</option>
    </select>
  </label>
  <form onsubmit={doChangePw} class="stack">
    <PwInput bind:value={oldPw} placeholder="지금 비밀번호" autocomplete="current-password" />
    <PwInput bind:value={newPw} placeholder="새 비밀번호" autocomplete="new-password" />
    <PwInput bind:value={newPw2} placeholder="새 비밀번호 확인" autocomplete="new-password" />
    <button disabled={!oldPw || !newPw}>비밀번호 바꾸기</button>
  </form>
  <button class="full" onclick={lock}>지금 잠그기</button>
</section>

<section class="card">
  <h2>앱으로 설치하기</h2>
  <ul class="small muted">
    <li><b>윈도우</b>: Edge나 Chrome 주소창 오른쪽의 "앱 설치" 아이콘</li>
    <li><b>안드로이드</b>: Chrome 메뉴 → "홈 화면에 추가" 또는 "앱 설치"</li>
    <li><b>iPhone</b>: Safari 공유 버튼 → "홈 화면에 추가"</li>
  </ul>
  <p class="muted small">기기마다 기록이 따로 저장돼요. 백업 파일로 옮기거나, 위의 "Google Drive 동기화"를 켜면 자동으로 맞출 수 있어요.</p>
</section>

<section class="card danger-zone">
  <h2>이 기기의 모든 기록 지우기</h2>
  <p class="muted small">되돌릴 수 없어요. 확인하려면 <b>모두 삭제</b>라고 입력하세요.</p>
  <div class="row">
    <input type="text" bind:value={wipeText} placeholder="모두 삭제" />
    <button class="danger" disabled={wipeText !== '모두 삭제'} onclick={doWipe}>삭제</button>
  </div>
</section>

<style>
  section { padding: 1rem 1.1rem; margin-bottom: 0.9rem; }
  h2 { font-size: 1rem; margin: 0 0 0.5rem; }
  p { margin: 0.4rem 0; }
  .row { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; margin: 0.6rem 0; }
  .row input { flex: 1; min-width: 8rem; }
  .stack { display: grid; gap: 0.5rem; margin: 0.8rem 0; }
  .filebtn { border: 1px solid var(--line); border-radius: var(--radius); padding: 0.5rem 0.9rem; cursor: pointer; background: var(--paper); }
  .filebtn:hover { border-color: var(--accent); }
  .filebtn input { display: none; }
  .inline { display: flex; align-items: center; gap: 0.8rem; white-space: nowrap; }
  .inline select { width: auto; }
  .full { width: 100%; }
  .check { display: flex; gap: 0.5rem; align-items: center; margin: 0.4rem 0; }
  .check input { width: auto; }
  ul { padding-left: 1.2rem; margin: 0.3rem 0; }
  code { font-size: 0.85em; background: var(--accent-soft); padding: 0 0.25rem; border-radius: 4px; }
  .ok { background: var(--accent-soft); padding: 0.6rem 0.9rem; border-radius: var(--radius); }
  .danger-zone { border-color: color-mix(in srgb, var(--danger) 40%, var(--line)); }
  .seg { display: flex; flex-wrap: wrap; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; width: fit-content; max-width: 100%; margin: 0.6rem 0; }
  .segb { border: none; border-radius: 0; border-right: 1px solid var(--line); padding: 0.4rem 0.85rem; font-size: 0.88rem; background: var(--paper); }
  .segb:last-child { border-right: none; }
  .segb.on { background: var(--accent); color: var(--paper); font-weight: 600; }
  .colors { display: flex; gap: 1.1rem; flex-wrap: wrap; margin: 0.7rem 0; }
  .colorpick { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; font-size: 0.8rem; color: var(--muted); }
  .colorpick input[type='color'] { width: 3rem; height: 2rem; padding: 0.15rem; cursor: pointer; }
</style>
