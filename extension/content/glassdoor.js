function extractGlassdoor() {
  const title = document.querySelector([
    '[data-test="job-title"]',
    'h1[class*="JobDetails"]',
    'div[class*="JobDetails_jobTitle"]',
    'h1[class*="job-title"]',
  ].join(', '))?.innerText?.trim();

  const company = document.querySelector([
    '[data-test="employer-name"]',
    'div[class*="JobDetails_header"] a',
    'a[class*="employer-name"]',
    '[class*="EmployerProfile"] a',
  ].join(', '))?.innerText?.trim();

  const location = document.querySelector([
    '[data-test="location"]',
    'div[class*="JobDetails_location"]',
    '[class*="job-location"]',
    '[class*="location"] span',
  ].join(', '))?.innerText?.trim();

  if (!title && !company) return null;

  return {
    jobTitle: title || '',
    companyName: company || '',
    location: location || '',
    jobUrl: window.location.href,
    jobBoardSource: 'Glassdoor',
  };
}
