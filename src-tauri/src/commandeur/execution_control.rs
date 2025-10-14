use std::sync::{Arc, Condvar, Mutex};

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ExecutionStatus {
    Idle,
    Running,
    Paused,
    Stopping,
}

#[derive(Debug)]
struct ExecutionState {
    status: ExecutionStatus,
    stop_reason: Option<String>,
}

struct ExecutionInner {
    state: Mutex<ExecutionState>,
    notify: Condvar,
}

#[derive(Clone)]
pub struct ExecutionControl {
    inner: Arc<ExecutionInner>,
}

#[derive(Debug, Clone)]
pub struct ExecutionInterrupt {
    pub reason: String,
}

impl ExecutionControl {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(ExecutionInner {
                state: Mutex::new(ExecutionState {
                    status: ExecutionStatus::Running,
                    stop_reason: None,
                }),
                notify: Condvar::new(),
            }),
        }
    }

    pub fn status(&self) -> ExecutionStatus {
        let guard = self.inner.state.lock().expect("execution status poisoned");
        guard.status
    }

    pub fn request_pause(&self) {
        let mut guard = self.inner.state.lock().expect("execution pause poisoned");
        if guard.status == ExecutionStatus::Running {
            guard.status = ExecutionStatus::Paused;
        }
    }

    pub fn request_resume(&self) {
        let mut guard = self.inner.state.lock().expect("execution resume poisoned");
        if guard.status == ExecutionStatus::Paused {
            guard.status = ExecutionStatus::Running;
            self.inner.notify.notify_all();
        }
    }

    pub fn request_stop(&self, reason: Option<String>) {
        let mut guard = self.inner.state.lock().expect("execution stop poisoned");
        guard.status = ExecutionStatus::Stopping;
        guard.stop_reason = reason;
        self.inner.notify.notify_all();
    }

    pub fn checkpoint(&self) -> Result<(), ExecutionInterrupt> {
        let mut guard = self
            .inner
            .state
            .lock()
            .expect("execution checkpoint poisoned");
        loop {
            match guard.status {
                ExecutionStatus::Running => return Ok(()),
                ExecutionStatus::Paused => {
                    guard = self
                        .inner
                        .notify
                        .wait(guard)
                        .expect("execution pause wait poisoned");
                }
                ExecutionStatus::Stopping => {
                    let reason = guard
                        .stop_reason
                        .clone()
                        .unwrap_or_else(|| "Exécution interrompue".to_string());
                    return Err(ExecutionInterrupt { reason });
                }
                ExecutionStatus::Idle => {
                    return Err(ExecutionInterrupt {
                        reason: "Aucune exécution active".to_string(),
                    })
                }
            }
        }
    }

    pub fn mark_finished(&self) {
        let mut guard = self.inner.state.lock().expect("execution finish poisoned");
        guard.status = ExecutionStatus::Idle;
        guard.stop_reason = None;
        self.inner.notify.notify_all();
    }
}
