const cfIPv4 = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/12',
  '172.64.0.0/17',
  '172.64.128.0/18',
  '172.64.192.0/19',
  '172.64.224.0/22',
  '172.64.229.0/24',
  '172.64.230.0/23',
  '172.64.232.0/21',
  '172.64.240.0/21',
  '172.64.248.0/21',
  '172.65.0.0/16',
  '172.66.0.0/16',
  '172.67.0.0/16',
  '131.0.72.0/22'
];
// 声明全局变量
let maxIP;
let testNo;
let validIPs;
let maxLatency;
let numberOfWorkingIPs;
let ipRegex;
let immediateStop = false;

// 获取DOM元素
const maxIpInput = document.getElementById('max-ip');
const maxLatencyInput = document.getElementById('max-latency');
const ipRegexInput = document.getElementById('ip-regex');
const ipIncludeInput = document.getElementById('ip-include');
const ipExcludeInput = document.getElementById('ip-exclude');
const resultTableBody = document.getElementById('result');
const startHint = document.getElementById('start-hint');
const testNoElement = document.getElementById('test-no');
const ipNoElement = document.getElementById('ip-no');
const ipTryElement = document.getElementById('ip-try');
const ipLatencyElement = document.getElementById('ip-latency');
const btnStart = document.getElementById('btn-start');
const btnCancel = document.getElementById('btn-cancel');

// 设置默认值
maxIpInput.value = localStorage.getItem('max-ip') || 15;
maxLatencyInput.value = localStorage.getItem('max-latency') || 400;
ipRegexInput.value = localStorage.getItem('ip-regex');
ipIncludeInput.value = localStorage.getItem('ip-include');
ipExcludeInput.value = localStorage.getItem('ip-exclude');

function cancelScan() {
  immediateStop = true;
}

function startScan() {
  // 获取输入值，不必在每次迭代中重新获取
  maxIP = ~~maxIpInput.value;
  maxLatency = ~~maxLatencyInput.value;
  ipRegex = ipRegexInput.value;
  ipInclude = ipIncludeInput.value;
  ipExclude = ipExcludeInput.value;

  // 保存输入值到localStorage
  localStorage.setItem('max-ip', maxIP);
  localStorage.setItem('max-latency', maxLatency);
  localStorage.setItem('ip-regex', ipRegex);
  localStorage.setItem('ip-include', ipInclude);
  localStorage.setItem('ip-exclude', ipExclude);

  testNo = 0;
  numberOfWorkingIPs = 0;
  validIPs = [];

  // 隐藏开始按钮，显示取消按钮
  btnStart.disabled = 'disabled';
  btnStart.style.color = 'gray';
  testNoElement.innerText = '';
  startHint.innerHTML = '在准备中 <img src="./assets/preparing.gif" height="16" />';
  startHint.style = 'color: green; font-weight: bold;';

  setTimeout(() => {
    var ips = [];
    var regex = null;
    var includeRegex = null;
    var excludeRegex = null;
    if (ipRegex) {
      regex = new RegExp(ipRegex);
    }
    if (ipInclude) {
      includeRegex = new RegExp(
        ipInclude.split(',').map(c => {return '^' + c.replaceAll('.', '\\.').replaceAll('/', '\\/')}).join('|')
      );
    }
    if (ipExclude) {
      excludeRegex = new RegExp(
        ipExclude.split(',').map(c => {return '^' + c.replaceAll('.', '\\.').replaceAll('/', '\\/')}).join('|')
      );
    }
    for (const cidr of cfIPv4) {
      if (regex && !regex.test(cidr)) {
        continue;
      }
      if (includeRegex && !includeRegex.test(cidr)) {
        continue;
      }
      if (excludeRegex && excludeRegex.test(cidr)) {
        continue;
      }
      ips = ips.concat(cidrToIpArray(cidr));
    }

    ips = randomizeElements(ips);

    startHint.style.display = 'none';
    btnStart.style.display = 'none';
    btnCancel.style.display = 'inline-block';
    testIPs(ips);
  }, 1000);
}

async function testIPs(ipList) {
  for (const ip of ipList) {
    if (immediateStop) {
      break;
    }
    testNo++;
    var testResult = 0;
    const url = `https://${ip}/__down`;
    const startTime = performance.now();
    const controller = new AbortController();
    const multiply = maxLatency <= 500 ? 1.5 : (maxLatency <= 1000 ? 1.2 : 1);
    var timeout = 1.5 * multiply * maxLatency;
    var chNo = 0;
    for (const ch of ['', '|', '/', '-', '\\']) {
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeout);
      if (ch) {
        timeout = 1 * multiply * maxLatency;
        testNoElement.innerText = `测试编号 ${testNo}:`;
        ipNoElement.innerText = ip;
        ipNoElement.style = 'color: green';
        ipTryElement.innerText = ch;
        ipLatencyElement.innerText = Math.floor((performance.now() - startTime) / chNo) + 'ms';
      } else {
        timeout = 1.2 * multiply * maxLatency;
        testNoElement.innerText = `测试编号 ${testNo}:`;
        ipNoElement.innerText = ip;
        ipNoElement.style = 'color: red';
        ipTryElement.innerText = '';
        ipLatencyElement.innerText = '';
      }
      try {
        const response = await fetch(url, {
          signal: controller.signal,
        });

        testResult++;
      } catch (error) {
        if (error.name === 'AbortError') {
          //
        } else {
          testResult++;
        }
      }
      clearTimeout(timeoutId);
      chNo++;
    }

    const latency = Math.floor((performance.now() - startTime) / 5);

    if (testResult === 5 && latency <= maxLatency) {
      numberOfWorkingIPs++;
      validIPs.push({ip: ip, latency: latency});
      const sortedArr = validIPs.sort((a, b) => a.latency - b.latency);
      const tableRows = sortedArr.map(obj => `
        <tr>
          <td></td>
          <td>${obj.ip}</td>
          <td>${obj.latency}ms</td>
          <td>
            <img height="16px" src="assets/copy.png" onclick="copyToClipboard('${obj.ip}')"/>
          </td>
        </tr>`).join('\n');
      document.getElementById('result').innerHTML = tableRows;
    }

    if (numberOfWorkingIPs >= maxIP) {
      break;
    }
  }

  ipNoElement.innerText = '';
  ipTryElement.innerText = '';
  ipLatencyElement.innerText = '';
  btnStart.innerText = '重新开始';
  btnStart.disabled = false;
  btnStart.style.display = 'inline-block';
  btnStart.style.color = 'green';
  btnCancel.style.display = 'none';

  if (immediateStop) {
    immediateStop = false;
    testNoElement.innerText = '已取消!';
    testNoElement.style = 'color: red; font-weight: bold;';
  } else {
    testNoElement.innerText = '结束';
    testNoElement.style = 'color: green; font-weight: bold;';
  }
}

function copyToClipboard(ip) {
  navigator.clipboard.writeText(ip).then(() => {
    alert('IP已复制到剪贴板。');
  }).catch(() => {
    alert('发生了问题！');
  });
}

function cidrToIpArray(cidr) {
  const parts = cidr.split('/');
  const ip = parts[0];
  const mask = parseInt(parts[1], 10);
  const ipParts = ip.split('.');
  const start = (
    (parseInt(ipParts[0], 10) << 24) |
    (parseInt(ipParts[1], 10) << 16) |
    (parseInt(ipParts[2], 10) << 8) |
    parseInt(ipParts[3], 10)
  ) >>> 0; // convert to unsigned int
  const end = (start | (0xffffffff >>> mask)) >>> 0; // convert to unsigned int

  const ips = [];
  for (let i = start; i <= end; i++) {
    const a = (i >> 24) & 0xff;
    const b = (i >> 16) & 0xff;
    const c = (i >> 8) & 0xff;
    const d = i & 0xff;
    ips.push(`${a}.${b}.${c}.${d}`);
  }
  return ips;
}

function randomizeElements(arr) {
  return [...arr].sort(() => {return 0.5 - Math.random()});
}

function downloadAsCSV() {
  const csvString = validIPs.map(el => el.ip).join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'ip-list.csv');
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadAsJSON() {
  const jsonString = JSON.stringify(validIPs.map(el => el.ip), null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'ip-list.json');
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}