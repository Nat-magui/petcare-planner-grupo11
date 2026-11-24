const taskForm = document.querySelector("#task-form");
const taskPet = document.querySelector("#task-pet");
const taskTitle = document.querySelector("#task-title");
const taskDescription = document.querySelector("#task-description");
const taskDate = document.querySelector("#task-date");
const taskTime = document.querySelector("#task-time");
const taskFormTitle = document.querySelector("#task-form-title");
const taskSubmit = document.querySelector("#task-submit");
const taskCancelEdit = document.querySelector("#task-cancel-edit");
const taskMessage = document.querySelector("#task-message");
const tasksList = document.querySelector("#tasks-list");
const filterButtons = document.querySelectorAll("[data-filter]");

const agendaParams = new URLSearchParams(window.location.search);
const requestedPetId = agendaParams.get("mascota");
let currentFilter = "all";
let editingTaskId = null;

seedInitialData();

let scopedPet = requestedPetId ? getPetById(requestedPetId) : null;

function showTaskMessage(message, type) {
  if (!taskMessage) {
    return;
  }

  taskMessage.textContent = message;
  taskMessage.className = `alert alert-${type}`;
}

function renderPetScope() {
  const scope = document.getElementById("agenda-pet-scope");
  scope.hidden = !scopedPet;
  document.getElementById("agenda-pet-scope-name").textContent = scopedPet?.name ?? "";
}

function renderPetOptions() {
  if (!taskPet) {
    return;
  }

  const pets = getPets();
  const petHelp = document.getElementById("task-pet-help");
  const submitButton = taskForm?.querySelector('button[type="submit"]');
  const hasPets = pets.length > 0;

  if (petHelp) petHelp.hidden = hasPets;
  if (submitButton) submitButton.disabled = !hasPets;
  taskPet.disabled = !hasPets;

  const options = pets.map((pet) => {
    return `<option value="${escapeHTML(pet.id)}">${escapeHTML(pet.name)}</option>`;
  });

  taskPet.innerHTML = `
    <option value="">Seleccionar mascota</option>
    ${options.join("")}
  `;
  if (scopedPet && pets.some((pet) => pet.id === scopedPet.id)) {
    taskPet.value = scopedPet.id;
  }
}

function renderTaskCard(task, pets) {
  const visualStatus = getTaskVisualStatus(task);
  const pet = getPetByIdFromList(pets, task.petId) ?? pets.find((item) => item.name === task.petId);
  const petName = pet?.name || "Mascota";
  const date = formatDateToDisplay(task.date);
  const time = formatTimeToDisplay(task.time);
  const description = task.description || "Sin descripcion cargada.";
  const completed = task.status === "done";
  const taskId = escapeHTML(task.id);

  return `
    <article class="card task-card" id="task-${escapeHTML(task.id)}" tabindex="-1">
      <header class="task-card-header">
        <section>
          <h3 class="card-title">${escapeHTML(task.title)}</h3>
          <p class="card-text">
            ${escapeHTML(petName)} &middot;
            ${escapeHTML(date)} &middot;
            ${escapeHTML(time)}
          </p>
        </section>

        <p class="badge ${escapeHTML(visualStatus.badgeClass)}">
          ${escapeHTML(visualStatus.label)}
        </p>
      </header>

      <p class="card-text">${escapeHTML(description)}</p>

      <footer class="task-card-actions">
        <button class="btn btn-ghost" type="button" data-edit-task="${taskId}">Editar</button>
        <button
          class="btn btn-secondary"
          type="button"
          data-task-status="${completed ? "pending" : "done"}"
          data-task-id="${taskId}"
        >
          ${completed ? "Volver a pendiente" : "Marcar realizada"}
        </button>
      </footer>
    </article>
  `;
}

function renderTasks(filter = currentFilter) {
  if (!tasksList) {
    return;
  }

  currentFilter = filter;
  filterButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.filter === currentFilter));
  });

  const tasks = scopedPet ? getTasksByPetId(scopedPet.id) : getTasks();
  const filteredTasks = filterTasksByVisualStatus(sortTasksByDate(tasks), filter);
  const pets = getPets();
  const content = filteredTasks.length > 0
    ? filteredTasks.map((task) => renderTaskCard(task, pets)).join("")
    : '<p class="card agenda-empty">No hay cuidados en este filtro.</p>';

  tasksList.innerHTML = content;
}

function setEditingTask(taskId = null) {
  editingTaskId = taskId;
  const isEditing = taskId !== null;
  taskFormTitle.textContent = isEditing ? "Editar cuidado" : "Agregar cuidado";
  taskSubmit.textContent = isEditing ? "Guardar cambios" : "Guardar cuidado";
  taskCancelEdit.hidden = !isEditing;
}

function resetTaskForm() {
  taskForm.reset();
  if (scopedPet) taskPet.value = scopedPet.id;
  setEditingTask();
}

function openTaskEditor(taskId) {
  if (editingTaskId === taskId) {
    taskTitle.focus();
    return;
  }

  const task = getTaskById(taskId);
  if (!task) {
    showTaskMessage("El cuidado que querés editar no está disponible.", "error");
    return;
  }

  renderPetOptions();
  const pets = getPets();
  const pet = getPetByIdFromList(pets, task.petId) ?? pets.find((item) => item.name === task.petId);
  taskPet.value = pet?.id ?? "";
  taskTitle.value = task.title ?? "";
  taskDescription.value = task.description ?? "";
  taskDate.value = formatDateForInput(task.date);
  taskTime.value = task.time ?? "";
  setEditingTask(task.id);
  showTaskMessage("", "info");
  (pet ? taskTitle : taskPet).focus();
}

function showSavedTask(task, message) {
  const changedPet = Boolean(scopedPet && scopedPet.id !== task.petId);
  if (changedPet) {
    scopedPet = null;
    const url = new URL(window.location.href);
    url.searchParams.delete("mascota");
    window.history.replaceState(window.history.state, "", url);
    renderPetScope();
    message += " Se quitó el filtro de mascota para mostrarla.";
  }

  const visibleInCurrentFilter =
    currentFilter === "all" || getTaskVisualStatus(task).key === currentFilter;

  renderTasks(visibleInCurrentFilter ? currentFilter : "all");
  if (!visibleInCurrentFilter) message += " Se seleccionó el filtro Todas.";
  showTaskMessage(message, "success");
  focusTaskCard(task.id);
}

function handleTaskSubmit(event) {
  event.preventDefault();

  const taskData = {
    petId: taskPet.value,
    title: taskTitle.value,
    description: taskDescription.value,
    date: taskDate.value,
    time: taskTime.value
  };

  if (!taskData.petId || !cleanText(taskData.title) || !taskData.date) {
    showTaskMessage("Completá los campos obligatorios.", "error");
    return;
  }

  if (!getPetById(taskData.petId)) {
    renderPetOptions();
    showTaskMessage("La mascota seleccionada ya no está disponible.", "error");
    if (taskPet.disabled) {
      document.querySelector("#task-pet-help a")?.focus();
    } else {
      taskPet.focus();
    }
    return;
  }

  const savedTask = editingTaskId ? updateTask(editingTaskId, taskData) : addTask(taskData);

  if (!savedTask) {
    showTaskMessage("No se pudo guardar el cuidado. Revisá los datos y volvé a intentar.", "error");
    return;
  }

  const message = editingTaskId ? "Cambios guardados." : "Tarea creada correctamente.";
  showSavedTask(savedTask, message);
  resetTaskForm();
}

function handleTaskFilter(event) {
  const button = event.target.closest("[data-filter]");

  if (!button) {
    return;
  }

  renderTasks(button.dataset.filter);
}

function handleTaskStatusChange(taskId, status) {
  const reopen = status === "pending";
  const updatedTask = reopen ? markTaskAsPending(taskId) : markTaskAsDone(taskId);

  if (!updatedTask) {
    showTaskMessage("No se pudo actualizar la tarea.", "error");
    return;
  }

  if (reopen) {
    showSavedTask(updatedTask, "El cuidado volvió a pendiente.");
    return;
  }

  showTaskMessage("Tarea marcada como realizada.", "success");
  renderTasks(currentFilter);
}

if (taskForm) {
  taskForm.addEventListener("submit", handleTaskSubmit);
}

taskCancelEdit?.addEventListener("click", () => {
  const taskId = editingTaskId;
  resetTaskForm();
  showTaskMessage("", "info");
  const taskCard = document.getElementById(`task-${taskId}`);
  (taskCard?.querySelector("[data-edit-task]") ?? taskTitle)?.focus();
});

filterButtons.forEach((button) => {
  button.addEventListener("click", handleTaskFilter);
});

if (tasksList) {
  tasksList.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-task]");
    if (editButton) {
      openTaskEditor(editButton.dataset.editTask);
      return;
    }

    const button = event.target.closest("[data-task-status]");

    if (button) {
      const taskId = button.dataset.taskId;
      handleTaskStatusChange(taskId, button.dataset.taskStatus);

      if (button.dataset.taskStatus === "done" && !button.isConnected) {
        const taskCard = document.getElementById(`task-${taskId}`);
        const activeFilter = Array.from(filterButtons).find((filterButton) => {
          return filterButton.dataset.filter === currentFilter;
        });
        (taskCard ?? activeFilter)?.focus();
      }
    }
  });
}

renderPetScope();
renderPetOptions();
renderTasks();

if (requestedPetId && !scopedPet) {
  showTaskMessage("La mascota solicitada no está disponible. Se muestran todos los cuidados.", "info");
}

function focusTaskCard(taskId) {
  document.getElementById(`task-${taskId}`)?.focus();
}

const linkedTaskId = agendaParams.get("tarea");

if (linkedTaskId) {
  focusTaskCard(linkedTaskId);
} else if (agendaParams.get("accion") === "nueva" && taskPet) {
  const firstControl = taskPet.disabled ? document.querySelector("#task-pet-help a") : taskPet;
  firstControl?.focus();
}
