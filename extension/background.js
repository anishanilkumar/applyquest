browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    browser.storage.local.get(['token', 'email', 'apiBaseUrl']).then(sendResponse);
    return true;
  }
  if (message.type === 'DO_LOGIN') {
    handleLogin(message.payload).then(sendResponse);
    return true;
  }
  if (message.type === 'SAVE_JOB') {
    handleSaveJob(message.payload).then(sendResponse);
    return true;
  }
  if (message.type === 'CLEAR_AUTH') {
    browser.storage.local.remove(['token', 'email', 'apiBaseUrl']).then(() =>
      sendResponse({ success: true })
    );
    return true;
  }
});

async function handleLogin({ apiBaseUrl, email, password }) {
  const body = new URLSearchParams({ username: email, password });
  try {
    const resp = await fetch(`${apiBaseUrl}/api/v1/access-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!resp.ok) {
      return { success: false, error: 'Invalid credentials. Check your email and password.' };
    }
    const data = await resp.json();
    await browser.storage.local.set({ token: data.access_token, email, apiBaseUrl });
    return { success: true };
  } catch (_) {
    return { success: false, error: 'Network error. Is the server reachable?' };
  }
}

async function handleSaveJob(payload) {
  const stored = await browser.storage.local.get(['token', 'apiBaseUrl']);
  if (!stored.token) {
    return { success: false, error: 'not_authenticated' };
  }

  const today = new Date().toISOString().split('T')[0];
  const body = {
    company_name: payload.companyName,
    position_title: payload.jobTitle,
    location: payload.location || 'Unknown',
    job_url: payload.jobUrl || null,
    status: 'Shortlisted',
    visa_sponsorship: false,
    german_requirement: 'None',
    relocation_support: false,
    effort: payload.effort || 'Unknown',
    job_board_source: payload.jobBoardSource || null,
    priority_stars: payload.priorityStars || 0,
    notes: payload.notes || null,
    applied_date: today,
  };

  try {
    const resp = await fetch(`${stored.apiBaseUrl}/api/v1/applications/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${stored.token}`,
      },
      body: JSON.stringify(body),
    });

    if (resp.status === 401) {
      return { success: false, error: 'token_expired' };
    }
    if (!resp.ok) {
      let detail = `HTTP ${resp.status}`;
      try { detail = (await resp.json()).detail || detail; } catch (_) {}
      return { success: false, error: detail };
    }
    const data = await resp.json();
    return { success: true, data };
  } catch (_) {
    return { success: false, error: 'Network error. Is the server reachable?' };
  }
}
