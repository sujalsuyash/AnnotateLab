// In-memory job store
export const jobs = {};

export function createJob(jobId, videoName, fps) {
  jobs[jobId] = {
    status: 'extracting',
    progress: 0,
    total: 0,
    results: [],
    error: null,
    videoName,
    fps,
    createdAt: Date.now(),
  };
}

export function deleteJobAfterDelay(jobId) {
  setTimeout(() => {
    delete jobs[jobId];
    console.log(`Job ${jobId} removed from memory`);
  }, 30 * 60 * 1000); // 30 minutes
}