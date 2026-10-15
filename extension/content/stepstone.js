function extractStepStone() {
  const title = document.querySelector([
    '[data-at="header-job-title"]',
    'h1[class*="at-header-company-jobTitle"]',
    'h1[class*="job-title"]',
    'h1[class*="JobTitle"]',
  ].join(', '))?.innerText?.trim();

  const company = document.querySelector([
    '[data-at="header-company-name"]',
    'a[class*="at-header-company-name"]',
    '[class*="company-name"] a',
    '[class*="CompanyName"]',
  ].join(', '))?.innerText?.trim();

  const location = document.querySelector([
    '[data-at="job-ad-details-location"]',
    'li[class*="at-listing__list-icons_location"]',
    '[class*="location"] span',
    '[class*="Location"]',
  ].join(', '))?.innerText?.trim();

  if (!title && !company) return null;

  return {
    jobTitle: title || '',
    companyName: company || '',
    location: location || '',
    jobUrl: window.location.href,
    jobBoardSource: 'StepStone',
  };
}
