function extractLinkedIn() {
  // LinkedIn obfuscates the DOM; parse document.title instead.
  // Format: "Job Title | Company Name | LinkedIn"
  const parts = document.title.split('|').map(s => s.trim());
  const jobTitle = parts[0] || '';
  // Last part is always "LinkedIn", company is the middle part
  const companyName = parts.length >= 3 ? parts[1] : '';

  if (!jobTitle) return null;

  return {
    jobTitle,
    companyName,
    location: '',
    jobUrl: window.location.href.split('?')[0],
    jobBoardSource: 'LinkedIn',
  };
}
