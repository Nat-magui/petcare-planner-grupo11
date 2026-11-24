const taskForm = document.querySelector("#task-form");
const taskPet = document.querySelector("#task-pet");
const taskTitle = document.querySelector("#task-title");
const taskDescription = document.querySelector("#task-description");
const taskDate = document.querySelector("#task-date");
const taskTime = document.querySelector("#task-time");
const taskMessage = document.querySelector("#task-message");
const tasksList = document.querySelector("#tasks-list");
const filterButtons = document.querySelectorAll("[data-filter]");

const agendaParams = new URLSearchParams(window.location.search);
const requestedPetId = agendaParams.get("mascota");
let currentFilter = "all";

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
  const doneAction = task.status !== "done"
    ? `
      <footer class="task-card-actions">
        <button
          class="btn btn-secondary"
          type="button"
          data-done="${escapeHTML(task.id)}"
        >
          Marcar realizada
        </button>
      </footer>
    `
    : "";

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

      ${doneAction}
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

function handleTaskSubmit(event) {
  event.preventDefault();

  const taskData = {
    petId: taskPet.value,
    title: taskTitle.value,
    description: taskDescription.value,
    date: taskDate.value,
    time: taskTime.value,
    status: "pending"
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

  const createdTask = addTask(taskData);

  if (!createdTask) {
    showTaskMessage("No se pudo guardar la tarea en este navegador. Volvé a intentar.", "error");
    return;
  }

  const changedPet = Boolean(scopedPet && scopedPet.id !== createdTask.petId);
  if (changedPet) {
    scopedPet = null;
    const url = new URL(window.location.href);
    url.searchParams.delete("mascota");
    window.history.replaceState(window.history.state, "", url);
    renderPetScope();
  }

  taskForm.reset();
  if (scopedPet) taskPet.value = scopedPet.id;

  const visibleInCurrentFilter =
    currentFilter === "all" || getTaskVisualStatus(createdTask).key === currentFilter;

  renderTasks(visibleInCurrentFilter ? currentFilter : "all");
  let message = "Tarea creada correctamente.";
  if (changedPet) message += " Se quitó el filtro de mascota para mostrarla.";
  if (!visibleInCurrentFilter) message += " Se seleccionó el filtro Todas.";
  showTaskMessage(message, "success");
  focusTaskCard(createdTask.id);
}

function handleTaskFilter(event) {
  const button = event.target.closest("[data-filter]");

  if (!button) {
    return;
  }

  renderTasks(button.dataset.filter);
}

function handleMarkTaskAsDone(taskId) {
  const updatedTask = markTaskAsDone(taskId);

  if (!updatedTask) {
    showTaskMessage("No se pudo actualizar la tarea.", "error");
    return;
  }

  showTaskMessage("Tarea marcada como realizada.", "success");
  renderTasks(currentFilter);
}

if (taskForm) {
  taskForm.addEventListener("submit", handleTaskSubmit);
}

filterButtons.forEach((button) => {
  button.addEventListener("click", handleTaskFilter);
});

if (tasksList) {
  tasksList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-done]");

    if (button) {
      const taskId = button.dataset.done;
      handleMarkTaskAsDone(taskId);

      if (!button.isConnected) {
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
