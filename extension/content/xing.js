function extractXing() {
  const title = document.querySelector([
    'h1[data-testid*="headline"]',
    'h1[class*="headline"]',
    '[data-testid="job-details-job-title"]',
    'h1[class*="job-title"]',
    'h1',
  ].join(', '))?.innerText?.trim();

  const company = document.querySelector([
    '[data-testid*="company-name"]',
    'a[class*="company-info__name"]',
    '[class*="company-name"] a',
    '[class*="CompanyInfo"] a',
  ].join(', '))?.innerText?.trim();

  const location = document.querySelector([
    '[data-testid*="location"]',
    '[class*="location"] span',
    'li[class*="location"]',
    '[class*="JobDetails"] [class*="location"]',
  ].join(', '))?.innerText?.trim();

  if (!title && !company) return null;

  return {
    jobTitle: title || '',
    companyName: company || '',
    location: location || '',
    jobUrl: window.location.href,
    jobBoardSource: 'XING',
  };
}
