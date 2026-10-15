const $ = (id) => document.getElementById(id);

const APPLYQUEST_URL = 'https://applyquest.anishsheela.com';

function showView(viewId) {
  ['viewUnauthenticated', 'viewForm', 'viewSuccess'].forEach(id => {
    $(id).classList.add('hidden');
  });
  $(viewId).classList.remove('hidden');
}

function showError(msg) {
  const el = $('errorMsg');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideError() {
  $('errorMsg').classList.add('hidden');
}

// --- Star rating ---
let selectedStars = 0;

function renderStars(hoverValue) {
  const current = hoverValue !== undefined ? hoverValue : selectedStars;
  document.querySelectorAll('.star').forEach(star => {
    star.classList.toggle('active', parseInt(star.dataset.value, 10) <= current);
  });
}

document.querySelectorAll('.star').forEach(star => {
  star.addEventListener('click', () => {
    const v = parseInt(star.dataset.value, 10);
    selectedStars = selectedStars === v ? 0 : v;
    $('priorityStars').value = selectedStars;
    renderStars();
  });
  star.addEventListener('mouseover', () => renderStars(parseInt(star.dataset.value, 10)));
  star.addEventListener('mouseout', () => renderStars());
});

// --- Populate form ---
function populateForm(data) {
  if (!data) return;
  $('jobTitle').value = data.jobTitle || '';
  $('companyName').value = data.companyName || '';
  $('location').value = data.location || '';
  $('jobBoardSource').value = data.jobBoardSource || '';
}

// --- Settings / nav ---
$('settingsBtn').addEventListener('click', () => browser.runtime.openOptionsPage());
$('goToSettingsBtn').addEventListener('click', () => browser.runtime.openOptionsPage());

// --- Form submit ---
let savedJobUrl = null;

$('jobForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const btn = $('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const payload = {
    jobTitle: $('jobTitle').value.trim(),
    companyName: $('companyName').value.trim(),
    location: $('location').value.trim(),
    jobBoardSource: $('jobBoardSource').value.trim() || null,
    effort: $('effort').value,
    priorityStars: parseInt($('priorityStars').value, 10) || 0,
    notes: $('notes').value.trim() || null,
    jobUrl: savedJobUrl,
  };

  const result = await browser.runtime.sendMessage({ type: 'SAVE_JOB', payload });

  btn.disabled = false;
  btn.textContent = 'Add to ApplyQuest';

  if (result.success) {
    $('viewLink').href = APPLYQUEST_URL;
    showView('viewSuccess');
    setTimeout(() => window.close(), 3000);
  } else if (result.error === 'not_authenticated') {
    showView('viewUnauthenticated');
  } else if (result.error === 'token_expired') {
    showError('Session expired. Please reconnect in Settings.');
  } else {
    showError(result.error || 'An error occurred. Please try again.');
  }
});

// --- Init ---
(async () => {
  const settings = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' });

  if (!settings.token) {
    showView('viewUnauthenticated');
    return;
  }

  showView('viewForm');

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      savedJobUrl = tab.url ? tab.url.split('?')[0] : null;

      let result = null;
      try {
        result = await browser.tabs.sendMessage(tab.id, { type: 'EXTRACT_JOB' });
      } catch (_) {
        // Content script not present — SPA navigation didn't trigger manifest injection.
        // Inject programmatically now (activeTab + scripting permissions allow this).
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          files: [
            'content/linkedin.js',
            'content/indeed.js',
            'content/glassdoor.js',
            'content/xing.js',
            'content/stepstone.js',
            'content/extractor.js',
          ],
        });
        result = await browser.tabs.sendMessage(tab.id, { type: 'EXTRACT_JOB' });
      }

      if (result && result.success && result.data) {
        populateForm(result.data);
        if (result.data.jobUrl) savedJobUrl = result.data.jobUrl;
      }
    }
  } catch (_) {
    // Not a supported page — user fills in manually
  }
})();
