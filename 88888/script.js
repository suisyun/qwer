// 問卷內容與分數對照表；送出前答案暫存在目前頁面。
const 問卷資料 = [
  {
    分類: '市場展望',
    題目: '你怎麼看接下來三個月的台股？',
    補充: '依照你現在的直覺選擇即可，沒有對錯。',
    選項: [
      {文字: '明顯看好，期待市場走高', 分數: 100},
      {文字: '略為看好，但仍會留意變化', 分數: 75},
      {文字: '看不太清楚，可能區間震盪', 分數: 50},
      {文字: '略為保守，預期市場承壓', 分數: 25},
      {文字: '相當謹慎，預期市場走弱', 分數: 0}
    ]
  },
  {
    分類: '投資行動',
    題目: '面對目前的市場，你比較可能怎麼做？',
    補充: '想想你接下來可能採取的投資步調。',
    選項: [
      {文字: '增加投入，把握看好的機會', 分數: 100},
      {文字: '維持投入，照原本計畫進行', 分數: 75},
      {文字: '先觀察，暫時不調整部位', 分數: 50},
      {文字: '減少投入，保留較多現金', 分數: 25},
      {文字: '暫停投資，等市場更明朗', 分數: 0}
    ]
  },
  {
    分類: '個人信心',
    題目: '你對自己目前的投資判斷有多大信心？',
    補充: '從 1 到 5 選一個最符合你現在感受的程度。',
    選項: [
      {文字: '非常有信心', 分數: 100},
      {文字: '有一些信心', 分數: 75},
      {文字: '普通，還在摸索', 分數: 50},
      {文字: '信心不太足', 分數: 25},
      {文字: '目前沒有把握', 分數: 0}
    ]
  },
  {
    分類: '投資規劃',
    題目: '你通常以多長的時間來安排投資？',
    補充: '這題用來補充你的答題摘要，不影響分數。',
    選項: [
      {文字: '短期，幾週到幾個月', 分數: null},
      {文字: '中期，約半年到兩年', 分數: null},
      {文字: '長期，兩年以上', 分數: null},
      {文字: '依不同標的調整', 分數: null}
    ]
  },
  {
    分類: '市場觀察',
    題目: '最近哪個因素最影響你的投資信心？',
    補充: '選擇目前最常放在心上的一項。',
    選項: [
      {文字: '企業獲利與產業景氣', 分數: null},
      {文字: '利率、通膨與匯率', 分數: null},
      {文字: '國際情勢與政策變化', 分數: null},
      {文字: '市場漲跌與資金流向', 分數: null},
      {文字: '自己的財務目標與風險承受度', 分數: null}
    ]
  }
];

const 各題答案 = Array(問卷資料.length).fill(null);
let 目前索引 = 0;

const 首頁 = document.querySelector('#首頁');
const 問卷 = document.querySelector('#問卷');
const 結果 = document.querySelector('#結果');
const 分類文字 = document.querySelector('#題目分類');
const 題目文字 = document.querySelector('#問卷標題');
const 補充文字 = document.querySelector('#題目補充');
const 選項容器 = document.querySelector('#選項列表');
const 下一題按鈕 = document.querySelector('#下一題');
const 上一題按鈕 = document.querySelector('#上一題');
const 送出狀態 = document.querySelector('#送出狀態');

// 網頁只使用可公開的金鑰；資料庫權限由列層級安全政策限制。
const 資料庫網址 = 'https://zsvttjpmsdzwwafkzezu.supabase.co';
const 公開金鑰 = 'sb_publishable_ezi6IfB5u8bx0NxIDyFSMA_QGkcK3lV';
let 正在送出 = false;
let VIX日線快取 = null;
let VIX載入工作 = null;

// 共用日線資料，避免首頁圖表和完成摘要重複下載。
async function 取得VIX日線資料() {
  if (VIX日線快取) return VIX日線快取;
  if (!VIX載入工作) {
    VIX載入工作 = (async () => {
      const 回應 = await fetch(`${資料庫網址}/functions/v1/vix-history`, {
        headers: {apikey: 公開金鑰}
      });
      if (!回應.ok) throw new Error(`VIX 資料載入失敗，回應代碼 ${回應.status}`);
      const 資料 = await 回應.json();
      if (!Array.isArray(資料) || 資料.length === 0) throw new Error('目前沒有可用的 VIX 日線資料。');
      VIX日線快取 = 資料;
      return 資料;
    })().finally(() => { VIX載入工作 = null; });
  }
  return VIX載入工作;
}

// 啟動時讀取 VIX 日線與每日問卷日期彙總。
async function 載入VIX圖表() {
  const 圖表 = document.querySelector('#VIX圖表');
  const 說明 = document.querySelector('#VIX說明');

  try {
    const [VIX資料, 日期回應] = await Promise.all([
      取得VIX日線資料(),
      fetch(`${資料庫網址}/rest/v1/tw_stock_confidence_response_dates?select=response_date,response_count&order=response_date.asc`, {
        headers: {apikey: 公開金鑰}
      })
    ]);

    let 問卷日期 = [];
    let 日期載入失敗 = false;

    if (日期回應.ok) {
      問卷日期 = await 日期回應.json();
    } else {
      日期載入失敗 = true;
    }

    畫出VIX圖表(VIX資料, 問卷日期, 日期載入失敗);
  } catch (錯誤) {
    console.error('VIX 圖表載入失敗：', 錯誤);
    圖表.textContent = '目前無法載入 VIX 日線，請確認網路連線後重新開啟頁面。';
    說明.textContent = 'VIX 資料暫時無法連線。';
    document.querySelector('#VIX收盤').textContent = '—';
    document.querySelector('#VIX漲跌').textContent = '尚未載入';
  }
}

// 用 SVG 畫出最近的每日 OHLC K 線，並以琥珀色線標示回答日期。
function 畫出VIX圖表(原始資料, 問卷日期, 日期載入失敗) {
  const 圖表 = document.querySelector('#VIX圖表');
  const 收盤文字 = document.querySelector('#VIX收盤');
  const 漲跌文字 = document.querySelector('#VIX漲跌');
  const 說明 = document.querySelector('#VIX說明');
  const 資料 = 原始資料
    .filter(資料列 => /^\d{4}-\d{2}-\d{2}$/.test(資料列.date)
      && [資料列.open, 資料列.high, 資料列.low, 資料列.close].every(Number.isFinite))
    .slice(-126);

  if (資料.length < 2) throw new Error('VIX 日線資料不足。');

  const 最新 = 資料[資料.length - 1];
  const 前一日 = 資料[資料.length - 2];
  const 漲跌 = 最新.close - 前一日.close;
  收盤文字.textContent = 最新.close.toFixed(2);
  漲跌文字.textContent = `較前日 ${漲跌 >= 0 ? '+' : ''}${漲跌.toFixed(2)}`;
  漲跌文字.classList.toggle('VIX上漲', 漲跌 >= 0);
  漲跌文字.classList.toggle('VIX下跌', 漲跌 < 0);
  document.querySelector('#VIX起點').textContent = 資料[0].date;
  document.querySelector('#VIX終點').textContent = 最新.date;

  const 畫布寬 = 680;
  const 畫布高 = 250;
  const 左邊距 = 38;
  const 右邊距 = 8;
  const 上邊距 = 16;
  const 下邊距 = 28;
  const 圖寬 = 畫布寬 - 左邊距 - 右邊距;
  const 圖高 = 畫布高 - 上邊距 - 下邊距;
  const 最低值 = Math.min(...資料.map(資料列 => 資料列.low));
  const 最高值 = Math.max(...資料.map(資料列 => 資料列.high));
  const 緩衝 = Math.max((最高值 - 最低值) * 0.08, 1);
  const 價格底 = Math.floor((最低值 - 緩衝) / 5) * 5;
  const 價格頂 = Math.ceil((最高值 + 緩衝) / 5) * 5;
  const 價格範圍 = 價格頂 - 價格底 || 1;
  const 價格Y = 價格 => 上邊距 + (價格頂 - 價格) / 價格範圍 * 圖高;
  const 間隔 = 圖寬 / 資料.length;
  const 燭身寬 = Math.max(1.5, Math.min(5, 間隔 * 0.62));

  let 格線 = '';
  for (let 刻度 = 0; 刻度 <= 3; 刻度 += 1) {
    const 價格 = 價格頂 - 價格範圍 * 刻度 / 3;
    const y = 價格Y(價格);
    格線 += `<line class="圖表格線" x1="${左邊距}" y1="${y}" x2="${畫布寬 - 右邊距}" y2="${y}" />`;
    格線 += `<text x="1" y="${y + 4}">${價格.toFixed(0)}</text>`;
  }

  const 燭線 = 資料.map((資料列, 索引) => {
    const x = 左邊距 + 間隔 * (索引 + 0.5);
    const 開盤Y = 價格Y(資料列.open);
    const 收盤Y = 價格Y(資料列.close);
    const 顏色 = 資料列.close >= 資料列.open ? '#d97460' : '#4b9a79';
    const 燭身Y = Math.min(開盤Y, 收盤Y);
    const 燭身高 = Math.max(Math.abs(收盤Y - 開盤Y), 1.5);
    return `<g><title>${資料列.date} 開 ${資料列.open.toFixed(2)} 高 ${資料列.high.toFixed(2)} 低 ${資料列.low.toFixed(2)} 收 ${資料列.close.toFixed(2)}</title><line class="圖表影線" x1="${x}" y1="${價格Y(資料列.high)}" x2="${x}" y2="${價格Y(資料列.low)}" stroke="${顏色}" /><rect class="圖表燭身" x="${x - 燭身寬 / 2}" y="${燭身Y}" width="${燭身寬}" height="${燭身高}" fill="${顏色}" stroke="${顏色}" /></g>`;
  }).join('');

  const 日期標記 = new Map();
  let 較早日期筆數 = 0;
  let 尚未更新筆數 = 0;
  問卷日期.forEach(資料列 => {
    const 日期 = String(資料列.response_date || '').slice(0, 10);
    const 筆數 = Math.max(1, Number(資料列.response_count) || 1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(日期)) return;
    if (日期 < 資料[0].date) {
      較早日期筆數 += 筆數;
      return;
    }

    let 索引 = 資料.findIndex(資料列 => 資料列.date >= 日期);
    if (索引 < 0) {
      索引 = 資料.length - 1;
      尚未更新筆數 += 筆數;
    }
    if (!日期標記.has(索引)) 日期標記.set(索引, []);
    日期標記.get(索引).push({日期, 筆數});
  });

  let 標記圖形 = '';
  日期標記.forEach((標記, 索引) => {
    const x = 左邊距 + 間隔 * (索引 + 0.5);
    const 位移 = 標記.length > 1 ? Math.min(間隔 * 0.22, 3) : 0;
    標記.forEach((回覆, 標記索引) => {
      const 點X = x + (標記索引 - (標記.length - 1) / 2) * 位移;
      const 標題 = `問卷回答日：${回覆.日期}，${回覆.筆數} 份`;
      標記圖形 += `<g><title>${標題}</title><line class="圖表事件線" x1="${點X}" y1="${上邊距}" x2="${點X}" y2="${上邊距 + 圖高}" /><circle class="圖表事件點" cx="${點X}" cy="${上邊距 + 4}" r="4" /></g>`;
    });
  });

  const 日期刻度 = [0, Math.floor((資料.length - 1) / 2), 資料.length - 1]
    .map(索引 => {
      const x = 左邊距 + 間隔 * (索引 + 0.5);
      return `<text text-anchor="middle" x="${x}" y="${畫布高 - 4}">${資料[索引].date.slice(5)}</text>`;
    }).join('');

  圖表.innerHTML = `<svg viewBox="0 0 ${畫布寬} ${畫布高}" preserveAspectRatio="none" aria-hidden="true">${格線}${標記圖形}${燭線}${日期刻度}</svg>`;

  const 狀態文字 = [];
  狀態文字.push(`顯示最近 ${資料.length} 個交易日；標記日期採台灣時區。`);
  if (較早日期筆數 > 0) 狀態文字.push(`${較早日期筆數} 份較早回答不在目前圖表範圍。`);
  if (尚未更新筆數 > 0) 狀態文字.push('最新 VIX 日線尚未涵蓋部分回答日，暫標於最右側，資料更新後會自動對齊。');
  if (日期載入失敗) 狀態文字.push('目前無法讀取問卷日期標記。');
  說明.textContent = 狀態文字.join(' ');
}

// 取得台灣日期，與資料庫記錄問卷日期的時區保持一致。
function 取得台灣日期() {
  const 日期欄位 = Object.fromEntries(new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date()).map(片段 => [片段.type, 片段.value]));
  return `${日期欄位.year}-${日期欄位.month}-${日期欄位.day}`;
}

// 讀取只含總份數與平均分數的安全彙總，不讀取任何人的答案。
async function 取得問卷分數統計() {
  const 回應 = await fetch(`${資料庫網址}/functions/v1/survey-summary`, {
    headers: {apikey: 公開金鑰}
  });
  if (!回應.ok) throw new Error(`平均分數載入失敗，回應代碼 ${回應.status}`);
  return 回應.json();
}

// 送出後顯示回答日期可用的 VIX 收盤與全體匿名回覆平均分數。
async function 載入結果市場摘要() {
  const VIX文字 = document.querySelector('#結果VIX');
  const VIX日期文字 = document.querySelector('#結果VIX日期');
  const 平均文字 = document.querySelector('#全體平均分數');
  const 平均說明 = document.querySelector('#全體平均說明');
  const 問卷日期 = 取得台灣日期();

  const [VIX結果, 統計結果] = await Promise.allSettled([
    取得VIX日線資料(),
    取得問卷分數統計()
  ]);

  if (VIX結果.status === 'fulfilled') {
    const 當日資料 = VIX結果.value
      .filter(資料列 => 資料列.date <= 問卷日期 && Number.isFinite(資料列.close))
      .at(-1);
    if (當日資料) {
      VIX文字.textContent = 當日資料.close.toFixed(2);
      VIX日期文字.textContent = `問卷日期 ${問卷日期}；採用 ${當日資料.date} 最新可用收盤`;
    } else {
      VIX文字.textContent = '暫無資料';
      VIX日期文字.textContent = '目前找不到問卷日期當日或之前的 VIX 收盤資料。';
    }
  } else {
    VIX文字.textContent = '暫時無法取得';
    VIX日期文字.textContent = 'VIX 日線連線失敗，請稍後重新整理。';
  }

  if (統計結果.status === 'fulfilled' && 統計結果.value) {
    const 回覆份數 = Number(統計結果.value.response_count) || 0;
    const 平均分數 = Number(統計結果.value.average_score);
    if (回覆份數 >= 5 && Number.isFinite(平均分數)) {
      平均文字.textContent = 平均分數.toFixed(1);
      平均說明.textContent = `共 ${回覆份數} 份匿名回覆，分數範圍為 0 至 100。`;
    } else {
      平均文字.textContent = '累積中';
      平均說明.textContent = `目前共 ${回覆份數} 份；至少累積 5 份才公開平均，以保護匿名性。`;
    }
  } else {
    平均文字.textContent = '暫時無法取得';
    平均說明.textContent = '平均分數連線失敗，請稍後重新整理。';
  }
}

// 切換目前顯示的畫面，並將焦點移到新畫面的主要內容。
function 顯示畫面(畫面) {
  [首頁, 問卷, 結果].forEach(區塊 => 區塊.classList.add('隱藏'));
  畫面.classList.remove('隱藏');
  window.scrollTo({top: 0, behavior: 'smooth'});
}

// 依照目前題目重畫選項，並回復先前已選的答案。
function 顯示題目() {
  const 資料 = 問卷資料[目前索引];
  const 題號 = 目前索引 + 1;
  分類文字.textContent = 資料.分類;
  題目文字.textContent = 資料.題目;
  補充文字.textContent = 資料.補充;
  document.querySelector('#目前題數').textContent = `第 ${題號} 題，共 ${問卷資料.length} 題`;
  const 進度 = Math.round(題號 / 問卷資料.length * 100);
  document.querySelector('#進度百分比').textContent = `${進度}%`;
  document.querySelector('#進度完成').style.width = `${進度}%`;
  上一題按鈕.disabled = 目前索引 === 0;
  送出狀態.textContent = '';
  送出狀態.classList.add('隱藏');
  送出狀態.classList.remove('狀態失敗');
  下一題按鈕.innerHTML = 目前索引 === 問卷資料.length - 1 ? '匿名送出並看摘要 <span aria-hidden="true">→</span>' : '下一題 <span aria-hidden="true">→</span>';

  選項容器.replaceChildren();
  資料.選項.forEach((選項, 選項索引) => {
    const 標籤 = document.createElement('label');
    標籤.className = '選項列';
    const 輸入框 = document.createElement('input');
    輸入框.type = 'radio';
    輸入框.name = `第${題號}題答案`;
    輸入框.value = String(選項索引);
    輸入框.checked = 各題答案[目前索引] === 選項索引;
    const 卡片 = document.createElement('span');
    卡片.className = '選項卡';
    const 圓點 = document.createElement('span');
    圓點.className = '選項圓點';
    圓點.setAttribute('aria-hidden', 'true');
    const 文字 = document.createElement('span');
    文字.className = '選項文字';
    文字.textContent = 選項.文字;
    卡片.append(圓點, 文字);
    標籤.append(輸入框, 卡片);
    輸入框.addEventListener('change', () => {
      各題答案[目前索引] = 選項索引;
      下一題按鈕.disabled = false;
    });
    選項容器.append(標籤);
  });
  下一題按鈕.disabled = 各題答案[目前索引] === null;
}

// 只用前三題的回答計算個人分數，後兩題僅用來補充摘要。
function 計算信心分數() {
  const 計分題目 = 問卷資料.slice(0, 3);
  const 總分 = 計分題目.reduce((加總, 資料, 索引) => 加總 + 資料.選項[各題答案[索引]].分數, 0);
  return Math.round(總分 / 計分題目.length);
}

function 取得信心分類(分數) {
  if (分數 >= 70) return '偏向樂觀';
  if (分數 >= 40) return '審慎觀察';
  return '偏向保守';
}

// 把答案送到 Supabase；成功後才顯示完成摘要。
async function 儲存回答() {
  if (正在送出) return;
  正在送出 = true;
  const 分數 = 計算信心分數();
  const 資料列 = {
    answers: Object.fromEntries(問卷資料.map((資料, 索引) => [資料.分類, 資料.選項[各題答案[索引]].文字])),
    score: 分數,
    confidence_level: 取得信心分類(分數)
  };
  送出狀態.textContent = '正在安全送出匿名回答，請稍候……';
  送出狀態.classList.remove('隱藏', '狀態失敗');
  下一題按鈕.disabled = true;
  上一題按鈕.disabled = true;
  document.querySelectorAll('#選項列表 input').forEach(輸入框 => { 輸入框.disabled = true; });
  下一題按鈕.textContent = '送出中……';

  try {
    const 回應 = await fetch(`${資料庫網址}/rest/v1/tw_stock_confidence_responses`, {
      method: 'POST',
      headers: {
        apikey: 公開金鑰,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(資料列)
    });
    if (!回應.ok) throw new Error(`送出失敗，回應代碼 ${回應.status}`);
    正在送出 = false;
    顯示結果();
  } catch (錯誤) {
    console.error('問卷送出失敗：', 錯誤);
    正在送出 = false;
    送出狀態.textContent = '目前無法送出，請確認網路連線後按「重試送出」。你的答案仍保留在這個頁面。';
    送出狀態.classList.remove('隱藏');
    送出狀態.classList.add('狀態失敗');
    下一題按鈕.innerHTML = '重試送出 <span aria-hidden="true">↻</span>';
    下一題按鈕.disabled = false;
    上一題按鈕.disabled = 目前索引 === 0;
    document.querySelectorAll('#選項列表 input').forEach(輸入框 => { 輸入框.disabled = false; });
  }
}

// 顯示已儲存的個人摘要。
function 顯示結果() {
  const 分數 = 計算信心分數();
  document.querySelector('#信心分數').textContent = String(分數);
  document.querySelector('#分數環').style.setProperty('--分數角度', `${分數 * 3.6}deg`);
  document.querySelector('#分數環').setAttribute('aria-label', `個人信心分數 ${分數} 分`);

  const 標籤 = document.querySelector('#結果標籤');
  const 描述 = document.querySelector('#結果描述');
  if (分數 >= 70) {
    標籤.textContent = 取得信心分類(分數);
    描述.textContent = '你對市場或自己的投資安排較有信心，持續依照計畫檢視每一步。';
  } else if (分數 >= 40) {
    標籤.textContent = 取得信心分類(分數);
    描述.textContent = '你保留一些彈性，邊觀察邊調整，找到適合自己的步調。';
  } else {
    標籤.textContent = 取得信心分類(分數);
    描述.textContent = '你目前較重視風險與安全感，可以先回顧自己的目標和承受範圍。';
  }

  const 摘要 = document.querySelector('#回答摘要');
  摘要.replaceChildren();
  問卷資料.forEach((資料, 索引) => {
    const 列 = document.createElement('div');
    列.className = '摘要列';
    const 標題 = document.createElement('dt');
    標題.textContent = 資料.分類;
    const 答案 = document.createElement('dd');
    答案.textContent = 資料.選項[各題答案[索引]].文字;
    列.append(標題, 答案);
    摘要.append(列);
  });
  顯示畫面(結果);
  載入結果市場摘要();
}

document.querySelector('#開始填答').addEventListener('click', () => {
  目前索引 = 0;
  顯示題目();
  顯示畫面(問卷);
});

document.querySelector('#回首頁').addEventListener('click', () => 顯示畫面(首頁));

上一題按鈕.addEventListener('click', () => {
  if (目前索引 > 0) {
    目前索引 -= 1;
    顯示題目();
  }
});

下一題按鈕.addEventListener('click', async () => {
  if (各題答案[目前索引] === null) return;
  if (目前索引 < 問卷資料.length - 1) {
    目前索引 += 1;
    顯示題目();
  } else {
    await 儲存回答();
  }
});

document.querySelector('#重新填答').addEventListener('click', () => {
  各題答案.fill(null);
  目前索引 = 0;
  顯示題目();
  顯示畫面(問卷);
});

載入VIX圖表();
