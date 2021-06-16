"use strict";

const form = document.querySelector(".form");
const containerWorkouts = document.querySelector(".workouts");
const inputType = document.querySelector(".form__input--type");
const inputDistance = document.querySelector(".form__input--distance");
const inputDuration = document.querySelector(".form__input--duration");
const inputCadence = document.querySelector(".form__input--cadence");
const inputElevation = document.querySelector(".form__input--elevation");

const btnThemeToggle = document.querySelector(".theme__toggle");
const loaderContainer = document.querySelector(".loader__container");
const loaderMsg = document.querySelector(".loader__msg");
const reset = document.querySelector(".reset");
const showAllMarkers = document.querySelector(".showAllMarkers");
const errorContainer = document.querySelector(".error");
const sort = document.querySelector(".sort");
const filterContainer = document.querySelector(".filter--container");

//modal
const modalOverlay = document.querySelector(".modal-overlay");
const modal = document.querySelector(".modal");
const modalContent = document.querySelector(".modal-content");
const modalActionsContainer = document.querySelector(".modal-actions");
const modalreset = document.querySelector(".modal--reset");
const modalretry = document.querySelector(".modal--retry");
const modalcancel = document.querySelector(".modal--cancel");

class Workout {
  date = new Date();
  id = (Date.now() + "").slice(-10);
  //prettier-ignore
  #months = ['January','February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  constructor(coords, distance, duration, id = this.id) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
    this.id = id;
  }

  _setDescription() {
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      this.#months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = "running";

  constructor(coords, distance, duration, cadence, id) {
    super(coords, distance, duration, id);
    this.cadence = cadence;
    this._calcPace();
    this._setDescription();
  }

  _calcPace() {
    this.pace = this.duration / this.distance;
  }
}

class Cycling extends Workout {
  type = "cycling";

  constructor(coords, distance, duration, elevation, id) {
    super(coords, distance, duration, id);
    this.elevation = elevation;
    this._calcSpeed();
    this._setDescription();
  }

  _calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
  }
}

class App {
  #i = 0;
  #editting = { flag: false, id: false };
  #map;
  #mapEvent;
  #workouts = [];
  #markers = [];
  #mapThemes = ["jawg-streets", "jawg-dark", "jawg-matrix"];
  #curTheme = 0;
  #zoomLevel = 15;

  constructor() {
    // Get Geolocation and load map
    this._getPosition();

    // Change loader message
    this._changeLoaderMsg();

    // Event Handlers
    form.addEventListener("submit", this._newWorkout.bind(this));
    inputType.addEventListener("change", this._toggleElevationField);
    btnThemeToggle.addEventListener("click", this._changeTheme.bind(this));
    containerWorkouts.addEventListener("click", this._moveToPopup.bind(this));

    reset.addEventListener("click", this._openModal);
    showAllMarkers.addEventListener("click", this._showAllMarkers.bind(this));
    sort.addEventListener("change", this._sort.bind(this));

    // prettier-ignore
    modalActionsContainer.addEventListener("click", this._performModalActions.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        this._errorGeoLocation.bind(this)
      );
  }

  _errorGeoLocation() {
    const html = `
      <div class="modal-content">
        <h1>Location access denied</h1>
        <p>This app has been blocked from accessing your location.
        This can happen if your browser's location services are turned off.
        To access the application please allow location services and try again.</p>
      </div>`;

    modalContent.innerHTML = "";
    modalreset.classList.add("hidden");
    modalretry.classList.remove("hidden");
    modalContent.insertAdjacentHTML("afterbegin", html);
    this._openModal();
  }

  _loadMap(pos) {
    const { latitude, longitude } = pos.coords;
    this.#map = L.map("map").setView([latitude, longitude], this.#zoomLevel);

    this._setTheme(this.#curTheme);

    this.#map.on("click", this._showForm.bind(this));

    this._activateThemeToggleBtn();

    // Check localStorage
    this._getLocalStorage();

    this._hideLoader();
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove("form--hidden");
    inputDistance.focus();
  }

  _hideForm() {
    form.style.display = "none";
    form.classList.add("form--hidden");
    setTimeout(() => (form.style.display = "grid"), 1000);
  }

  _hideLoader() {
    this.#i = -1;
    loaderContainer.classList.add("hidden");
  }

  _toggleElevationField() {
    if (inputType.value === "running") {
      inputCadence.closest(".form__row").classList.remove("hidden");
      inputElevation.closest(".form__row").classList.add("hidden");
    }

    if (inputType.value === "cycling") {
      inputElevation.closest(".form__row").classList.remove("hidden");
      inputCadence.closest(".form__row").classList.add("hidden");
    }
  }

  _showActions(e) {
    const actionsContainer = e.target.closest(".workout");

    if (!actionsContainer) return;

    actionsContainer.classList.remove("actions--hidden");
  }

  _hideActions(e) {
    e.target.classList.add("actions--hidden");
  }

  _setTheme(curTheme) {
    const theme = localStorage.getItem("theme");
    if (theme) curTheme = theme;
    L.tileLayer(
      // prettier-ignore
      `https://{s}.tile.jawg.io/${this.#mapThemes[curTheme]}/{z}/{x}/{y}{r}.png?access-token={accessToken}`,
      {
        minZoom: 2,
        maxZoom: 20,
        accessToken:
          "tnDgmf82TKLmg953RubxnjG53Sp3lXiuXacV87x2RPrcGkESyD5F9e8L5J5XSefl",
      }
    ).addTo(this.#map);
  }

  _changeTheme() {
    // prettier-ignore
    this.#curTheme === this.#mapThemes.length - 1 ? this.#curTheme = 0 : this.#curTheme++;
    localStorage.setItem("theme", this.#curTheme);
    this._setTheme(this.#curTheme);
  }

  _clearInputFields() {
    // prettier-ignore
    inputCadence.value = inputDistance.value = inputDuration.value = inputElevation.value = '';
  }

  _newWorkout(e) {
    e.preventDefault();

    const validInputs = (...inputs) =>
      inputs.every((inp) => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every((inp) => inp > 0);

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    window.scrollTo(0, 0);

    // If workout is Running, create running object
    if (type === "running") {
      const cadence = +inputCadence.value;

      // Check if the data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        this._clearInputFields();
        return this._throwMessage(
          "Input fields only accepts positive numbers. No alphabets or special characters are allowed."
        );
      }

      //coords, distance, duration, cadence
      if (this.#editting.flag)
        //prettier-ignore
        workout = new Running([lat, lng], distance, duration, cadence, this.#editting.id);

      if (!this.#editting.flag)
        workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout is Cycling, create cycling object
    if (type === "cycling") {
      const elevation = +inputElevation.value;

      // Check if the data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        this._clearInputFields();
        return this._throwMessage(
          "Input fields only accepts positive numbers. No alphabets or special characters are allowed."
        );
      }

      if (this.#editting.flag)
        //prettier-ignore
        workout = new Cycling([lat, lng], distance, duration, elevation, this.#editting.id);

      if (!this.#editting.flag)
        workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new Onject to workout array
    this.#workouts.push(workout);

    // Render workout on the map as marker
    this._renderMarker(workout);

    // Render workout in the list
    this._renderWorkout(workout);

    // Hide form + clear form
    this._clearInputFields();
    this._hideForm();

    // Show Reset Btn
    this._showMapActionBtns();

    // Show Filters
    this._showFilters();

    // Show Message
    if (!this.#editting.flag)
      this._throwMessage(`A new ${workout.type} workout has been added.`);

    if (this.#editting.flag) this._throwMessage(`Workout has been edited.`);

    // Save to local storage
    this._setLocalStorage();

    // Reset Edit Flag
    this.#editting.flag = false;
  }

  _editWorkout(workout) {
    this.#editting.flag = true;
    this.#editting.id = workout.id;
    this._showForm({
      latlng: { lat: workout.coords[0], lng: workout.coords[1] },
    });
    inputDistance.value = workout.distance;
    inputDuration.value = workout.duration;
    inputType.value = workout.type;

    if (workout.type === "running") {
      inputCadence.value = workout.cadence;
    }

    if (workout.type === "cycling") {
      inputElevation.value = workout.elevation;
    }
    this._deleteWorkout(workout, true);
  }

  _renderMarker(workout) {
    this.#markers.push(
      L.marker(workout.coords)
        .addTo(this.#map)
        .bindPopup(
          L.popup({
            maxWidth: 250,
            minWidth: 100,
            autoClose: false,
            closeOnClick: false,
            className: `${workout.type}-popup`,
          })
        )
        .setPopupContent(
          `${workout.type === "running" ? "🏃🏻" : "🚴🏼"} ${workout.description}`
        )
        .openPopup()
    );
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type} actions--hidden" data-id="${
      workout.id
    }">
    <div class="actions">
      <button title="Edit Workout" class="btn action__btn edit__btn"><i>✎</i></button>
      <button title="Delete Workout" class="btn action__btn delete__btn"><i>⨯</i></button>
    </div>
      <h2 class="workout__title">${workout.description}</h2>
      <div class="workout__details">
        <span class="workout__icon">${
          workout.type === "running" ? "🏃🏻" : "🚴🏼"
        }</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">${
          workout.distance > 1 ? "kms" : "km"
        }</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
      </div>`;

    if (workout.type === "running") {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>`;
    }

    if (workout.type === "cycling") {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevation}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>`;
    }

    form.insertAdjacentHTML("afterend", html);

    const workoutEls = document.querySelectorAll(".workout");
    workoutEls.forEach((workoutEl) => {
      workoutEl.addEventListener("mouseleave", this._hideActions);
      workoutEl.addEventListener("mouseenter", this._showActions);
    });
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest(".workout");
    const deleteBtn = e.target.closest(".delete__btn");
    const editBtn = e.target.closest(".edit__btn");

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      (workout) => workout.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#zoomLevel, {
      animate: true,
      duration: 0.5,
    });

    if (editBtn) this._editWorkout(workout);
    if (deleteBtn) this._deleteWorkout(workout);
  }

  _setLocalStorage() {
    localStorage.setItem("workouts", JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const workouts = JSON.parse(localStorage.getItem("workouts"));

    this._loadWorkouts(workouts);
  }

  _loadWorkouts(workouts) {
    if (!workouts || workouts.length === 0) {
      this._throwMessage(`Welcome to Mapty App!`);
      return;
    }

    workouts.forEach((workout) => {
      if (workout.type === "running") {
        const running = new Running(
          workout.coords,
          workout.distance,
          workout.duration,
          workout.cadence,
          workout.id
        );
        this.#workouts.push(running);
      }

      if (workout.type === "cycling") {
        const cycling = new Cycling(
          workout.coords,
          workout.distance,
          workout.duration,
          workout.elevation,
          workout.id
        );
        this.#workouts.push(cycling);
      }
    });

    this.#workouts.forEach((workout) => {
      this._renderMarker(workout);
      this._renderWorkout(workout);
    });

    // Show Reset Btn
    this._showMapActionBtns();

    // Show Filters
    this._showFilters();

    // Show Message
    this._throwMessage(`Welcome Back! All your saved workouts are now loaded.`);
  }

  _sort(e) {
    const sortValue = e.target.value.split("+");
    this.#workouts = this.#workouts.sort((a, b) => {
      if (sortValue[1] === "asc") {
        this._throwMessage(
          `The workouts are now sorted by ${sortValue[0]} in descending order`
        );
        return a[sortValue[0]] - b[sortValue[0]];
      }
      if (sortValue[1] === "des") {
        this._throwMessage(
          `The workouts are now sorted by ${sortValue[0]} in ascending order`
        );
        return b[sortValue[0]] - a[sortValue[0]];
      }
    });

    this._deleteAllWorkoutHTML();
    this.#workouts.forEach((workout) => this._renderWorkout(workout));
  }

  _deleteWorkout(workout, editting = false) {
    const index = this.#workouts.indexOf(workout);
    if (this.#workouts.length === 1) this._hideMapActionBtns();
    this.#workouts.splice(index, 1);
    this._hideFilters();
    this._deleteMarker(index);
    this._deleteWorkoutHTML(workout);
    if (!editting)
      this._throwMessage(`Workout "${workout.description}" has been deleted.`);
    this._setLocalStorage();
  }

  _deleteMarker(index) {
    this.#markers[index].remove();
    this.#markers.splice(index, 1);
  }

  _deleteWorkoutHTML(workout) {
    const workoutEl = document.querySelector(
      `.workout[data-id='${workout.id}']`
    );
    workoutEl.remove();
  }

  _deleteAllWorkoutHTML() {
    const allWorkoutEls = document.querySelectorAll(".workout");
    allWorkoutEls.forEach((workoutEl) => workoutEl.remove());
  }

  _showMapActionBtns() {
    reset.classList.remove("hidden");
  }

  _hideMapActionBtns() {
    reset.classList.add("hidden");
  }

  _showFilters() {
    if (this.#workouts.length > 1) {
      filterContainer.classList.remove("hidden");
    }
  }

  _hideFilters() {
    if (this.#workouts.length <= 1) {
      filterContainer.classList.add("hidden");
    }
  }

  _reset() {
    this._closeModal();

    this._deleteAllWorkoutHTML();

    this.#markers.forEach((marker) => {
      marker.remove();
    });
    this.#markers = [];

    this.#workouts = [];

    localStorage.removeItem("workouts");

    this._hideForm();

    this._hideMapActionBtns();

    this._hideFilters();

    this._throwMessage(`All the workouts are now deleted.`);
  }

  _showAllMarkers() {
    const bounds = [];
    this.#workouts.forEach((workout) => bounds.push(workout.coords));
    this.#map.fitBounds([bounds]);
  }

  _performModalActions(e) {
    if (e.target === modalcancel) this._closeModal();
    if (e.target === modalreset) this._reset();
    if (e.target === modalretry) this._reload();
  }

  _openModal() {
    modal.classList.remove("hidden");
    modalOverlay.classList.remove("hidden");
  }

  _closeModal() {
    modal.classList.add("hidden");
    modalOverlay.classList.add("hidden");
  }

  _reload() {
    location.reload();
  }

  _activateThemeToggleBtn() {
    btnThemeToggle.classList.remove("hidden");
  }

  _throwMessage(msg) {
    errorContainer.textContent = msg;
    errorContainer.classList.remove("error--hidden");

    errorContainer.addEventListener("click", this._hideMessage);

    setTimeout(() => this._hideMessage(), 5000);
  }

  _hideMessage() {
    errorContainer.classList.add("error--hidden");
  }

  _wait(seconds) {
    return new Promise(function (resolve) {
      setTimeout(resolve, seconds * 1000);
    });
  }

  async _changeLoaderMsg() {
    const loaderMessages = [
      "Fetching your location...",
      "Still fetching your location...",
      "You are a tough one to find...",
      "Something is terribly wrong it should not take this long...",
      "Are you sure you have your location services turned on?",
    ];

    loaderMsg.textContent = loaderMessages[this.#i];
    await this._wait(5);

    if (this.#i === -1) return;

    this.#i++;

    if (this.#i <= loaderMessages.length - 1) {
      this._changeLoaderMsg(this.#i);
    } else {
      await this._wait(3);
      this._errorGeoLocation();
    }
  }
}

const app = new App();
