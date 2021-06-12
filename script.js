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

class Workout {
  date = new Date();
  id = (Date.now() + "").slice(-10);
  //prettier-ignore
  #months = ['January','February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  constructor(coords, distance, duration) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
  }

  _setDescription() {
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      this.#months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = "running";

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
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

  constructor(coords, distance, duration, elevation) {
    super(coords, distance, duration);
    this.elevation = elevation;
    this._calcSpeed();
    this._setDescription();
  }

  _calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
  }
}

class App {
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

    // Check loaclaStorage
    this._getLocalStorage();

    // Event Handlers
    form.addEventListener("submit", this._newWorkout.bind(this));
    inputType.addEventListener("change", this._toggleElevationField);
    btnThemeToggle.addEventListener("click", this._changeTheme.bind(this));
    containerWorkouts.addEventListener("click", this._moveToPopup.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        this._errorGeoLocation
      );
  }

  _errorGeoLocation() {
    alert("Error getting your location!");
  }

  _loadMap(pos) {
    const { latitude, longitude } = pos.coords;
    this.#map = L.map("map").setView([latitude, longitude], this.#zoomLevel);

    this._setTheme(this.#curTheme);

    this.#map.on("click", this._showForm.bind(this));

    this._activateThemeToggleBtn();

    this.#workouts.forEach((workout) => {
      this._renderMarker(workout);
    });

    loaderContainer.style.display = "none";
  }

  _activateThemeToggleBtn() {
    btnThemeToggle.classList.remove("theme__toggle--hidden");
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove("hidden");
    inputDistance.focus();
  }

  _hideForm() {
    form.style.display = "none";
    form.classList.add("hidden");
    setTimeout(() => (form.style.display = "grid"), 1000);
    window.scroll(0, 0);
  }

  _showActions(e) {
    const actionsContainer = e.target.closest(".workout");

    if (!actionsContainer) return;

    actionsContainer.classList.remove("actions--hidden");
  }

  _hideActions(e) {
    e.target.classList.add("actions--hidden");
  }

  _toggleElevationField() {
    inputElevation.closest(".form__row").classList.toggle("form__row--hidden");
    inputCadence.closest(".form__row").classList.toggle("form__row--hidden");
  }

  _setTheme(curTheme) {
    L.tileLayer(
      // prettier-ignore
      `https://{s}.tile.jawg.io/${this.#mapThemes[curTheme]}/{z}/{x}/{y}{r}.png?access-token={accessToken}`,
      {
        // attribution:
        //   '<a href="http://jawg.io" title="Tiles Courtesy of Jawg Maps" target="_blank">&copy; <b>Jawg</b>Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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

    // If workout is Running, create running object
    if (type === "running") {
      const cadence = +inputCadence.value;

      // Check if the data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        this._clearInputFields();
        return alert("Enter Valid Number");
      }

      //coords, distance, duration, cadence
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
        return alert("Enter Valid Number");
      }

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

    // Save to local storage
    this._setLocalStorage();
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
      <button class="action__btn edit__btn">✎</button>
      <button class="action__btn delete__btn">⨯</button>
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

    if (!workouts) return;

    this.#workouts = workouts;

    this.#workouts.forEach((workout) => {
      this._renderWorkout(workout);
    });
  }

  _editWorkout(workout) {}

  _deleteWorkout(workout) {
    const workoutIndex = this.#workouts.indexOf(workout);
    this.#workouts.splice(workoutIndex, 1);
    this._setLocalStorage();
    this._deleteMarker(workoutIndex);
    this._clearWorkoutHTML();
    this._getLocalStorage();
  }

  _deleteMarker(index) {
    this.#markers[index].remove();
  }

  _clearWorkoutHTML() {
    const allWorkoutEl = document.querySelectorAll(".workout");
    allWorkoutEl.forEach((workoutEl) => workoutEl.remove());
  }
}

const app = new App();
