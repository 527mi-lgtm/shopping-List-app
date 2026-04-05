import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE_URL = `file:///${__dirname.replace(/\\/g, '/')}/shopping-list.html`;

let passed = 0;
let failed = 0;

function log(label, ok, detail = '') {
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${label}${detail ? ' — ' + detail : ''}`);
  ok ? passed++ : failed++;
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const page = await browser.newPage();

  // localStorage 초기화
  await page.goto(FILE_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  console.log('\n🧪 쇼핑 리스트 앱 자동 테스트 시작\n');
  console.log('URL:', FILE_URL, '\n');

  // ── TEST 1: 초기 상태 ──────────────────────────────────
  console.log('── [1] 초기 상태 확인 ──');
  const emptyMsg = await page.locator('.empty').textContent();
  log('빈 상태 메시지 표시', emptyMsg.includes('아이템을 추가'));

  // ── TEST 2: 아이템 추가 ────────────────────────────────
  console.log('\n── [2] 아이템 추가 ──');
  await page.fill('#input', '사과');
  await page.click('button:has-text("+")');
  let items = await page.locator('.item').count();
  log('아이템 추가 (버튼)', items === 1);

  await page.fill('#input', '바나나');
  await page.press('#input', 'Enter');
  items = await page.locator('.item').count();
  log('아이템 추가 (Enter 키)', items === 2);

  await page.fill('#input', '우유');
  await page.press('#input', 'Enter');
  items = await page.locator('.item').count();
  log('아이템 3개 추가 확인', items === 3);

  const statsText = await page.locator('#stats').textContent();
  log('헤더 통계 업데이트', statsText.includes('3'));

  // ── TEST 3: 빈 입력 방지 ──────────────────────────────
  console.log('\n── [3] 빈 입력 방지 ──');
  await page.fill('#input', '   ');
  await page.press('#input', 'Enter');
  items = await page.locator('.item').count();
  log('공백만 입력 시 추가 안 됨', items === 3);

  // ── TEST 4: 체크 기능 ──────────────────────────────────
  console.log('\n── [4] 체크(완료) 기능 ──');
  const firstCheckbox = page.locator('.item input[type="checkbox"]').first();
  await firstCheckbox.check();
  const checkedItems = await page.locator('.item.checked').count();
  log('체크 시 .checked 클래스 적용', checkedItems === 1);

  const strikeStyle = await page.locator('.item.checked .item-text').evaluate(
    el => window.getComputedStyle(el).textDecoration
  );
  log('체크된 아이템 취소선 표시', strikeStyle.includes('line-through'));

  const stats2 = await page.locator('#stats').textContent();
  log('완료 카운트 통계 반영', stats2.includes('완료 1'));

  // 체크 해제
  await firstCheckbox.uncheck();
  const checkedAfterUncheck = await page.locator('.item.checked').count();
  log('체크 해제 동작', checkedAfterUncheck === 0);

  // ── TEST 5: 필터 기능 ─────────────────────────────────
  console.log('\n── [5] 필터 기능 ──');
  // 사과 체크
  await page.locator('.item input[type="checkbox"]').first().check();

  await page.locator('.filters button').filter({ hasText: /^완료$/ }).click();
  const doneItems = await page.locator('.item').count();
  log('완료 필터: 완료 항목만 표시', doneItems === 1);

  await page.locator('.filters button').filter({ hasText: /^미완료$/ }).click();
  const activeItems = await page.locator('.item').count();
  log('미완료 필터: 미완료 항목만 표시', activeItems === 2);

  await page.locator('.filters button').filter({ hasText: /^전체$/ }).click();
  const allItems = await page.locator('.item').count();
  log('전체 필터: 모든 항목 표시', allItems === 3);

  // ── TEST 6: 개별 삭제 ─────────────────────────────────
  console.log('\n── [6] 개별 삭제 ──');
  const deleteBtn = page.locator('.delete-btn').last();
  await deleteBtn.click();
  items = await page.locator('.item').count();
  log('아이템 개별 삭제', items === 2);

  // ── TEST 7: 완료 항목 일괄 삭제 ───────────────────────
  console.log('\n── [7] 완료 항목 일괄 삭제 ──');
  // 현재 체크된 항목(사과)이 있는 상태
  const checkedCount = await page.locator('.item.checked').count();
  log('일괄 삭제 전 완료 항목 존재', checkedCount >= 1);

  await page.click('.clear-btn');
  const afterClear = await page.locator('.item').count();
  log('완료 항목 일괄 삭제', afterClear === checkedCount === 0 ? 0 : items - checkedCount);

  // ── TEST 8: localStorage 유지 ─────────────────────────
  console.log('\n── [8] 새로고침 후 데이터 유지 ──');
  await page.fill('#input', '새 항목');
  await page.press('#input', 'Enter');
  const beforeReload = await page.locator('.item').count();
  await page.reload();
  const afterReload = await page.locator('.item').count();
  log('새로고침 후 데이터 유지 (localStorage)', beforeReload === afterReload);

  // ── 최종 결과 ─────────────────────────────────────────
  console.log('\n══════════════════════════════');
  console.log(`테스트 완료: ✅ ${passed}개 통과 / ❌ ${failed}개 실패`);
  console.log('══════════════════════════════\n');

  await browser.close();
})();