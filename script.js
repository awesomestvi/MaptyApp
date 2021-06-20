'use strict';

const form = document.querySelector('.form');
const btnCancel = document.querySelector('.cancel');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

const mapUIContainer = document.querySelector('.map_UI');
const btnThemeToggle = document.querySelector('.theme__toggle');
const btnMyLocation = document.querySelector('.mylocation');
const loaderContainer = document.querySelector('.loader__container');
const loaderMsg = document.querySelector('.loader__msg');
const reset = document.querySelector('.reset');
const showAllMarkers = document.querySelector('.showAllMarkers');
const errorContainer = document.querySelector('.error');
const sort = document.querySelector('.sort');
const filterContainer = document.querySelector('.filter--container');
const welcomeMessage = document.querySelector('.welcome__message');

//modal
const modalOverlay = document.querySelector('.modal-overlay');
const modal = document.querySelector('.modal');
const modalBody = document.querySelector('.modal-body');
const modalContent = document.querySelector('.modal-content');
const modalActionsContainer = document.querySelector('.modal-actions');
const modalreset = document.querySelector('.modal--reset');
const modalretry = document.querySelector('.modal--retry');
const modaldelete = document.querySelector('.modal--delete');
const modalcancel = document.querySelector('.modal--cancel');

const locationQIApiKey = '9372d4a1eb6c7817eb360b4776cd13d8';
const openWeatherMapApiKey = '908a9045b7ece945f62d6b7c11325dae';
const leafletApiKey = 'tnDgmf82TKLmg953RubxnjG53Sp3lXiuXacV87x2RPrcGkESyD5F9e8L5J5XSefl';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  location;
  weather;

  #months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  constructor(coords, distance, duration, location = this.location, weather = this.weather, id = this.id, date = this.date) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
    this.location = location;
    this.weather = weather;
    this.id = id;
    this.date = date;
  }

  _setDescription() {
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${this.#months[this.date.getMonth()]} ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence, location, weather, id, date) {
    super(coords, distance, duration, location, weather, id, date);
    this.cadence = cadence;
    this._calcPace();
    this._setDescription();
  }

  _calcPace() {
    this.pace = this.duration / this.distance;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevation, location, weather, id, date) {
    super(coords, distance, duration, location, weather, id, date);
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
  #editting = {flag: false, id: false, date: false, location: false, weather: false};
  #map;
  #mapEvent;
  #workouts = [];
  #markers = [];
  #mapThemes = ['jawg-dark', 'jawg-streets', 'jawg-matrix'];
  #curTheme = 0;
  #zoomLevel = 14;
  #mylocation;
  #confirmDeleteWorkout;

  constructor() {
    // Get Geolocation and load map
    this._getPosition();

    // Change loader message
    this._changeLoaderMsg();

    // Event Handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    mapUIContainer.addEventListener('click', this._mapUIActions.bind(this));
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    btnCancel.addEventListener('click', this._hideForm);
    reset.addEventListener('click', () => this._setModalContent('reset'));
    showAllMarkers.addEventListener('click', this._showAllWorkouts.bind(this));
    sort.addEventListener('change', this._sort.bind(this));

    modalActionsContainer.addEventListener('click', this._performModalActions.bind(this));
    errorContainer.addEventListener('click', this._hideMessage);

    // unload
    window.addEventListener('beforeunload', this._unsavedChanges);
  }

  _getPosition() {
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), this._errorGeoLocation.bind(this));
  }

  _errorGeoLocation() {
    this._setModalContent('geolocation');
  }

  _loadMap(pos) {
    this.#mylocation = pos.coords;
    const {latitude, longitude} = pos.coords;
    this.#map = L.map('map').setView([latitude, longitude], this.#zoomLevel);

    this._setTheme(this.#curTheme);

    this.#map.on('click', this._showForm.bind(this));

    this._activateThemeToggleBtn();

    // Check localStorage
    this._getLocalStorage();

    this._hideLoader();
  }

  _panToMyLocation() {
    const {latitude, longitude} = this.#mylocation;
    this.#map.setView([latitude, longitude], this.#zoomLevel + 1, {
      animate: true,
      duration: 0.5,
    });

    this._getLocationAndWeather(latitude, longitude).finally(() => {
      this._throwMessage(`Current Location: ${this.#editting.location}`);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    const {lat, lng} = this.#mapEvent.latlng;
    this._hideWelcomeMessage();
    this._getLocationAndWeather(lat, lng).finally(() => {
      form.classList.remove('form--hidden');
      inputDistance.focus();
    });
  }

  _hideForm(e) {
    if (!e) form.style.display = 'none';
    form.classList.add('form--hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _hideLoader() {
    this.#i = -1;
    loaderContainer.classList.add('hidden');
  }

  _toggleElevationField() {
    if (inputType.value === 'running') {
      inputCadence.closest('.form__row').classList.remove('hidden');
      inputElevation.closest('.form__row').classList.add('hidden');
    }

    if (inputType.value === 'cycling') {
      inputElevation.closest('.form__row').classList.remove('hidden');
      inputCadence.closest('.form__row').classList.add('hidden');
    }
  }

  _showActions(e) {
    const actionsContainer = e.target.closest('.workout');

    if (!actionsContainer) return;

    actionsContainer.classList.remove('actions--hidden');
  }

  _hideActions(e) {
    e.target.classList.add('actions--hidden');
  }

  _setTheme(curTheme) {
    const theme = localStorage.getItem('theme');
    if (theme) curTheme = theme;
    L.tileLayer(`https://{s}.tile.jawg.io/${this.#mapThemes[curTheme]}/{z}/{x}/{y}{r}.png?access-token={accessToken}`, {
      minZoom: 2,
      maxZoom: 20,
      accessToken: leafletApiKey,
    }).addTo(this.#map);
  }

  _mapUIActions(e) {
    if (e.target === btnThemeToggle) this._changeTheme();
    if (e.target === btnMyLocation) this._panToMyLocation();
  }

  _changeTheme() {
    this.#curTheme === this.#mapThemes.length - 1 ? (this.#curTheme = 0) : this.#curTheme++;
    localStorage.setItem('theme', this.#curTheme);
    this._setTheme(this.#curTheme);
  }

  _clearInputFields() {
    inputCadence.value = inputDistance.value = inputDuration.value = inputElevation.value = '';
  }

  _newWorkout(e) {
    e.preventDefault();

    let validationText = [];

    const validInputs = (...inputs) => inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);
    const getInvalidFields = (...inputs) =>
      inputs.forEach(inp => {
        if (+inp.value === 0) {
          validationText.push(inp.previousElementSibling.textContent);
        }
      });

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const {lat, lng} = this.#mapEvent.latlng;
    let workout;

    window.scrollTo(0, 0);

    // If workout is Running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;

      // Check if the data is valid

      if (!validInputs(distance, duration, cadence) || !allPositive(distance, duration, cadence)) {
        getInvalidFields(inputDistance, inputDuration, inputCadence);
        this._throwMessage(`${validationText.join(' and ')} is required.`);
        return;
      }

      //coords, distance, duration, cadence
      if (this.#editting.flag) workout = new Running([lat, lng], distance, duration, cadence, this.#editting.location, this.#editting.weather, this.#editting.id, this.#editting.date);

      if (!this.#editting.flag) workout = new Running([lat, lng], distance, duration, cadence, this.#editting.location, this.#editting.weather);
    }

    // If workout is Cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      // Check if the data is valid
      if (!validInputs(distance, duration, elevation) || !allPositive(distance, duration)) {
        getInvalidFields(inputDistance, inputDuration, inputElevation);
        this._throwMessage(`${validationText.join(' and ')} is required.`);
        return;
      }

      if (this.#editting.flag) workout = new Cycling([lat, lng], distance, duration, elevation, this.#editting.location, this.#editting.weather, this.#editting.id, this.#editting.date);

      if (!this.#editting.flag) workout = new Cycling([lat, lng], distance, duration, elevation, this.#editting.location, this.#editting.weather);
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
    if (!this.#editting.flag) this._throwMessage(`A new ${workout.type} workout has been added.`);

    if (this.#editting.flag) this._throwMessage(`Workout has been edited.`);

    // Save to local storage
    this._setLocalStorage();

    // Reset Edit Flag
    this.#editting.flag = false;
  }

  _getLocationAndWeather(lat, lng) {
    return Promise.all([this._getLocationDetails(lat, lng), this._getLocationWeather(lat, lng)])
      .then(([res1, res2]) => {
        const {road, suburb, city, country} = res1.address;
        this.#editting.location = Object.values({road, suburb, city, country})
          .filter(l => l !== undefined)
          .join(', ');
        this.#editting.weather = {...res2.main, ...res2.weather[0]};
      })
      .catch(err => {});
  }

  async _getLocationDetails(lat, lng) {
    try {
      const res = await fetch(`https://eu1.locationiq.com/v1/reverse.php?key=pk.${locationQIApiKey}&lat=${lat}&lon=${lng}&format=json`);

      if (!res.ok) throw new Error(`Could not get location details of the your workout [${res.status}]`);
      return await res.json();
    } catch (err) {
      this._throwMessage(err);
    }
  }

  async _getLocationWeather(lat, lng) {
    try {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${openWeatherMapApiKey}`);

      if (!res.ok) throw new Error(`Could not get the weather details of your workout location [${res.status}]`);
      return await res.json();
    } catch (err) {
      this._throwMessage(err);
    }
  }

  _editWorkout(workout) {
    this.#editting.flag = true;
    this.#editting.id = workout.id;
    this.#editting.date = new Date(workout.date);
    this.#editting.location = workout.location;
    this.#editting.weather = workout.weather;

    this._showForm({
      latlng: {lat: workout.coords[0], lng: workout.coords[1]},
    });
    inputDistance.value = workout.distance;
    inputDuration.value = workout.duration;
    inputType.value = workout.type;

    if (workout.type === 'running') {
      inputCadence.value = workout.cadence;
    }

    if (workout.type === 'cycling') {
      inputElevation.value = workout.elevation;
    }
    this._deleteWorkout(workout, true);
  }

  _renderMarker(workout) {
    this.#markers.push(
      L.marker(workout.coords, {
        icon: L.icon({
          iconUrl: 'https://vishal-chauhan-apps.netlify.app/icon.png',
          iconSize: [50, 50],
          iconAnchor: [25, 50],
          popupAnchor: [0, -50],
        }),
      })
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
        .setPopupContent(`${workout.type === 'running' ? '🏃🏻' : '🚴🏼'} ${workout.description}`)
        .openPopup()
    );
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type} actions--hidden" data-id="${workout.id}">
      <div class="actions">
        <button title="Edit Workout" class="btn action__btn edit__btn"><i>✎</i></button>
        <button title="Delete Workout" class="btn action__btn delete__btn"><i>⨯</i></button>
      </div>
      <div class="workout__header--container">
        <div class="workout_header">
          <h2 class="workout__title">${workout.description}</h2>
          <address class="workout__location">
            ${workout.location}
          </address>
        </div>
        <div class="workout__weather">
          <div class="workout__weather--details temp">
            <img src="https://openweathermap.org/img/wn/${workout.weather.icon}@2x.png"/> ${Math.trunc(workout.weather.temp)}℃
          </div>
          <div class="workout__weather--details otherinfo">
              Feels like: ${Math.trunc(workout.weather.feels_like)}° <br/> H: ${Math.trunc(workout.weather.temp_max)}° L: ${Math.trunc(workout.weather.temp_min)}°
          </div>
        </div>
      </div>
      <div title="Distance" class="workout__details">
        <span class="workout__icon">${workout.type === 'running' ? '🏃🏻' : '🚴🏼'}</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">${workout.distance > 1 ? 'kms' : 'km'}</span>
      </div>
      <div title="Duration" class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
      </div>`;

    if (workout.type === 'running') {
      html += `
      <div title="Pace" class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.pace.toFixed(1)}</span>
        <span class="workout__unit">min/km</span>
      </div>
      <div title="Cadence" class="workout__details">
        <span class="workout__icon">🦶🏼</span>
        <span class="workout__value">${workout.cadence}</span>
        <span class="workout__unit">spm</span>
      </div>`;
    }

    if (workout.type === 'cycling') {
      html += `
      <div title="Speed" class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.speed.toFixed(1)}</span>
        <span class="workout__unit">km/h</span>
      </div>
      <div title="Elevation Gain" class="workout__details">
        <span class="workout__icon">⛰</span>
        <span class="workout__value">${workout.elevation}</span>
        <span class="workout__unit">m</span>
      </div>`;
    }

    html += `</li>`;

    form.insertAdjacentHTML('afterend', html);

    const workoutEls = document.querySelectorAll('.workout');
    workoutEls.forEach(workoutEl => {
      workoutEl.addEventListener('mouseleave', this._hideActions);
      workoutEl.addEventListener('mouseenter', this._showActions);
    });
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');
    const deleteBtn = e.target.closest('.delete__btn');
    const editBtn = e.target.closest('.edit__btn');

    if (!workoutEl) return;

    const workout = this.#workouts.find(workout => workout.id === workoutEl.dataset.id);

    this.#map.setView(workout.coords, this.#zoomLevel, {
      animate: true,
      duration: 0.5,
    });

    if (editBtn) this._editWorkout(workout);
    if (deleteBtn) this._setModalContent('delete', workout);
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const workouts = JSON.parse(localStorage.getItem('workouts'));

    this._loadWorkouts(workouts);
  }

  _loadWorkouts(workouts) {
    if (!workouts || workouts.length === 0) return;

    this._hideWelcomeMessage();

    workouts.forEach(workout => {
      if (workout.type === 'running') {
        const running = new Running(workout.coords, workout.distance, workout.duration, workout.cadence, workout.location, workout.weather, workout.id, new Date(workout.date));
        this.#workouts.push(running);
      }

      if (workout.type === 'cycling') {
        const cycling = new Cycling(workout.coords, workout.distance, workout.duration, workout.elevation, workout.location, workout.weather, workout.id, new Date(workout.date));
        this.#workouts.push(cycling);
      }
    });

    this.#workouts.forEach(workout => {
      this._renderMarker(workout);
      this._renderWorkout(workout);
    });

    // Show Reset Btn
    this._showMapActionBtns();

    // Show Filters
    this._showFilters();

    // Show Message
    this._throwMessage(`Welcome Back! You have ${workouts.length} saved ${workouts.length === 1 ? 'workout' : 'workouts'}.`);
  }

  _sort(e) {
    const sortValue = e.target.value.split('+');
    this.#workouts = this.#workouts.sort((a, b) => {
      if (sortValue[1] === 'asc') {
        this._throwMessage(`The workouts are now sorted by ${sortValue[0]} in ascending order`);
        return b[sortValue[0]] - a[sortValue[0]];
      }
      if (sortValue[1] === 'des') {
        this._throwMessage(`The workouts are now sorted by ${sortValue[0]} in descending order`);
        return a[sortValue[0]] - b[sortValue[0]];
      }
    });

    this._deleteAllWorkoutHTML();
    this.#workouts.forEach(workout => this._renderWorkout(workout));
  }

  _deleteWorkout(workout, editting = false) {
    this._confirmDelete(workout);
    const index = this.#workouts.indexOf(workout);
    if (this.#workouts.length === 1) this._hideMapActionBtns();
    this.#workouts.splice(index, 1);
    if (this.#workouts.length === 0 && !editting) this._showWelcomeMessage();
    this._hideFilters();
    this._deleteMarker(index);
    this._deleteWorkoutHTML(workout);
    if (!editting) this._throwMessage(`Workout "${workout.description}" has been deleted.`);
    this._setLocalStorage();
  }

  _deleteMarker(index) {
    this.#markers[index].remove();
    this.#markers.splice(index, 1);
  }

  _deleteWorkoutHTML(workout) {
    const workoutEl = document.querySelector(`.workout[data-id='${workout.id}']`);
    workoutEl.remove();
  }

  _deleteAllWorkoutHTML() {
    const allWorkoutEls = document.querySelectorAll('.workout');
    allWorkoutEls.forEach(workoutEl => workoutEl.remove());
  }

  _showMapActionBtns() {
    reset.classList.remove('hidden');
  }

  _hideMapActionBtns() {
    reset.classList.add('hidden');
  }

  _showFilters() {
    if (this.#workouts.length > 1) {
      filterContainer.classList.remove('hidden');
    }
  }

  _hideFilters() {
    if (this.#workouts.length <= 1) {
      filterContainer.classList.add('hidden');
    }
  }

  _reset() {
    this._closeModal();

    this._deleteAllWorkoutHTML();

    this.#markers.forEach(marker => {
      marker.remove();
    });
    this.#markers = [];

    this.#workouts = [];

    localStorage.removeItem('workouts');

    this._hideForm();

    this._hideMapActionBtns();

    this._hideFilters();

    this._showWelcomeMessage();

    this._throwMessage(`All the workouts are now deleted.`);
  }

  _showAllWorkouts() {
    const bounds = [];
    this.#workouts.forEach(workout => bounds.push(workout.coords));
    this.#map.fitBounds([bounds]);
  }

  _performModalActions(e) {
    if (e.target === modalcancel) this._closeModal();
    if (e.target === modalreset) this._reset();
    if (e.target === modalretry) this._reload();
    if (e.target === modaldelete) this._deleteWorkout(this.#confirmDeleteWorkout);
  }

  _setModalContent(type, workout = false) {
    let html;

    modaldelete.classList.add('hidden');
    modalreset.classList.add('hidden');
    modalretry.classList.add('hidden');
    modalBody.classList.remove('short');

    if (type === 'reset') {
      html = `
      <div class="modal-content">
        <h1>Warning!</h1>
        <p>
          Are you sure you want to delete all workouts and reset the application?
          <span>Note: This action cannot be reversed</span>
        </p>
      </div>`;

      modalreset.classList.remove('hidden');
    }

    if (type === 'geolocation') {
      html = `
      <div class="modal-content">
        <h1>Location access denied</h1>
        <p>This app has been blocked from accessing your location.
        This can happen if your browser's location services are turned off.
        To access the application please allow location services and try again.</p>
      </div>`;

      modalretry.classList.remove('hidden');
    }

    if (type === 'delete') {
      html = `
      <div class="modal-content">
        <h1>${workout.description}</h1>
        <p>Are you sure you want to delete this workout?</p>
      </div>`;

      modalBody.classList.add('short');
      this.#confirmDeleteWorkout = workout;
      modaldelete.classList.remove('hidden');
    }

    modalContent.innerHTML = '';
    modalContent.insertAdjacentHTML('afterbegin', html);
    this._openModal();
  }

  _openModal() {
    modal.classList.remove('hidden');
    modalOverlay.classList.remove('hidden');
  }

  _closeModal() {
    modal.classList.add('hidden');
    modalOverlay.classList.add('hidden');
  }

  _reload() {
    location.reload();
  }

  _activateThemeToggleBtn() {
    btnThemeToggle.classList.remove('hidden');
  }

  _throwMessage(msg) {
    errorContainer.textContent = msg;
    errorContainer.classList.remove('error--hidden');
    setTimeout(this._hideMessage, 5000);
  }

  _hideMessage() {
    errorContainer.classList.add('error--hidden');
  }

  _wait(seconds) {
    return new Promise(function (resolve) {
      setTimeout(resolve, seconds * 1000);
    });
  }

  async _changeLoaderMsg() {
    const loaderMessages = [
      'Fetching your location...',
      'Still fetching your location...',
      'You are a tough one to find...',
      'Something is terribly wrong it should not take this long...',
      'Are you sure you have your location services turned on?',
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

  _unsavedChanges(e) {
    if (!form.classList.contains('form--hidden')) {
      e.preventDefault();
      e.returnValue = '';
    }
  }

  _hideWelcomeMessage() {
    welcomeMessage.classList.add('hidden');
  }

  _showWelcomeMessage() {
    welcomeMessage.classList.remove('hidden');
  }
}

const app = new App();
