function extractIndeed() {
  const title = document.querySelector([
    'h1.jobsearch-JobInfoHeader-title',
    'h1[class*="jobTitle"]',
    '[data-testid="jobsearch-JobInfoHeader-title"]',
    '[data-testid*="jobTitle"]',
  ].join(', '))?.innerText?.trim();

  const company = document.querySelector([
    '[data-testid="inlineHeader-companyName"] a',
    '[data-testid="inlineHeader-companyName"]',
    'span[class*="companyName"]',
    '[class*="icl-u-lg-mr--sm"] a',
    '[class*="jobsearch-InlineCompanyRating"] a',
  ].join(', '))?.innerText?.trim();

  const location = document.querySelector([
    '[data-testid="job-location"]',
    '[data-testid="jobsearch-JobInfoHeader-companyLocation"]',
    '[class*="companyLocation"]',
  ].join(', '))?.innerText?.trim();

  if (!title && !company) return null;

  return {
    jobTitle: title || '',
    companyName: company || '',
    location: location || '',
    jobUrl: window.location.href,
    jobBoardSource: 'Indeed',
  };
}
