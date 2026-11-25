<script lang="ts">
  import Icon from './Icon.svelte'

  let {
    value = $bindable(''),
    placeholder = '',
    autocomplete = 'off',
    id,
    autofocus = false,
  }: { value?: string; placeholder?: string; autocomplete?: string; id?: string; autofocus?: boolean } = $props()

  let show = $state(false)
</script>

<div class="pwrap">
  <!-- svelte-ignore a11y_autofocus -->
  <input {id} type={show ? 'text' : 'password'} {placeholder} autocomplete={autocomplete as 'new-password'} {autofocus} bind:value />
  <button type="button" class="eye" tabindex="-1" onclick={() => (show = !show)} aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'} aria-pressed={show}>
    <Icon name={show ? 'eye-off' : 'eye'} />
  </button>
</div>

<style>
  .pwrap { position: relative; }
  .pwrap input { padding-right: 2.3rem; }
  .eye {
    position: absolute; right: 0.3rem; top: 50%; transform: translateY(-50%);
    border: none; background: transparent; padding: 0.3rem; color: var(--muted); display: flex;
  }
  .eye:hover { color: var(--accent); }
</style>
