import { open } from '@tauri-apps/plugin-shell';
import { JIRA_BASE_URL } from './constants';

/**
 * Opens the Jira issue page in the user's default browser.
 * 
 * @param issueKey The Jira issue key (e.g., "PROJ-123")
 */
export async function openIssueInBrowser(issueKey: string): Promise<void> {
  if (!issueKey) return;
  
  const url = `${JIRA_BASE_URL.replace(/\/$/, '')}/browse/${issueKey}`;
  try {
    await open(url);
  } catch (error) {
    console.error(`Failed to open issue URL: ${url}`, error);
  }
}
