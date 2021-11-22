(() => {
  const DateTime = luxon.DateTime;

  const channel = new MessageChannel();
  const port1 = channel.port1;
  const port2 = channel.port2;

  // always a Sunday
  const EasterDates = {
    2017: [4, 16],
    2018: [4, 1],
    2019: [4, 21],
    2020: [4, 12],
    2021: [4, 4],
    2022: [4, 17],
    2023: [4, 9],
    2024: [3, 31],
    2025: [4, 20],
    2026: [4, 5],
    2027: [3, 28],
    2028: [4, 16],
  };

  const Status = {
    Unplanned: '',
    Planned: 'planned',
    Requested: 'requested',
    Approved: 'approved',
  };

  class Day {
    constructor(month, number) {
      this.month = month;
      this.year = month.year;
      this.number = number;
      this.fullNumber = number.toString().padStart(2, '0');
      this.status = Status.Unplanned;
    }

    toDateTime() {
      return DateTime.fromISO(this.getIsoDate());
    }

    getName() {
      return this.toDateTime().toFormat('cccc');
    }

    getShortName() {
      return this.toDateTime().toFormat('ccc');
    }

    getIsoDate() {
      return `${this.year.number}-${this.month.fullNumber}-${this.fullNumber}`;
    }

    getClass() {
      const classes = {};

      const dateTime = this.toDateTime();

      if(dateTime.weekday == 6) {
        classes.weekend = true;
        classes.saturday = true;
      } else if(dateTime.weekday == 7) {
        classes.weekend = true;
        classes.sunday = true;
      }

      if(this.status != Status.Unplanned) {
        classes[this.status] = true;
      }

      if(this.isHoliday()) {
        classes['holiday'] = true;
      }

      if(this.isHalfHoliday()) {
        classes['half-holiday'] = true;
      }

      if(this.isToday()) {
        classes['today'] = true;
      }

      return classes;
    }

    isHoliday() {
      return this.getHolidayName() != undefined;
    }

    getHolidayName() {
      switch(`${this.month.fullNumber}-${this.fullNumber}`) {
        case '01-01':
          return 'New Year\'s Day';
        case '05-01':
          return 'Labour Day';
        case '10-03':
          return 'German Unity Day';
        case '11-01':
          return 'All Saints\' Day';
        case '12-25':
          return 'Christmas Day';
        case '12-26':
          return '2nd Day of Christmas';
      }

      const easterDate = this.year.getEasterDate();
      const thisDate = this.toDateTime();

      const diff = thisDate.diff(easterDate, 'days');

      switch(diff.days) {
        case -2:
          return 'Good Friday';
        case 0:
          return 'Easter Sunday';
        case 1:
          return 'Easter Monday';
        case 39: // shouldn't this be 40?
          return 'Ascension Day';
        case 50:
          return 'Whit Monday';
        case 60:
          return 'Corpus Christi';
      }
    }

    isHalfHoliday() {
      return this.month.number == 12 && [24, 31].includes(this.number);
    }

    isWeekend() {
      return [6, 7].includes(this.toDateTime().weekday);
    }

    increaseStatus() {
      if(this.isHoliday() || this.isWeekend()) {
        return this.status;
      }

      return this.status = this.nextStatus();
    }

    nextStatus() {
      switch(this.status) {
        default:
          return Status.Planned;
        case Status.Planned:
          return Status.Requested;
        case Status.Requested:
          return Status.Approved;
        case Status.Approved:
          return Status.Unplanned;
      }
    }

    setStatus(status) {
      if(this.isHoliday() || this.isWeekend()) {
        return this.status;
      }

      if(status != undefined) {
        this.status = status;
      }

      return this.status;
    }

    getStatusValue() {
      switch(this.status) {
        default:
          return 0;
        case Status.Planned:
          return 1;
        case Status.Requested:
          return 2;
        case Status.Approved:
          return 3;
      }
    }

    isToday() {
      const now = DateTime.now();

      if(now.year == this.year.number && now.month == this.month.number && now.day == this.number) {
        return true;
      }

      return false;
    }
  }

  class Month {
    constructor(year, number) {
      this.year = year;
      this.number = number; /* 1..12 */
      this.fullNumber = number.toString().padStart(2, '0');
      this.days = [...Array(31).keys()].map(index => new Day(this, index + 1))
        .filter(day => DateTime.fromObject({year: year.number, month: number, day: day.number}).isValid);
    }

    getName() {
      return this.days[0].toDateTime().toFormat('MMMM');
    }

    getShortName() {
      return this.days[0].toDateTime().toFormat('MMM');
    }

    getIsoDate() {
      return `${this.year.number}-${this.fullNumber}`;
    }
  }

  class Year {
    constructor(number) {
      this.number = number;
      this.months = [...Array(12).keys()].map(index => new Month(this, index + 1));
    }

    getAllDays() {
      return this.months.map(month => month.days).reduce((all, cur) => [...all, ...cur], []);
    }

    countStatusMin(minStatus) {
      return this.getAllDays()
        .map(day => [day.getStatusValue(), day.isHalfHoliday() ? 0.5 : 1])
        .reduce((sum, [status, value]) => status >= minStatus ? sum + value : sum, 0);
    }

    countPlanned() {
      return this.countStatusMin(1);
    }

    countRequested() {
      return this.countStatusMin(2);
    }

    countApproved() {
      return this.countStatusMin(3);
    }

    getEasterDate() {
      const [month, day] = EasterDates[this.number];

      return DateTime.fromObject({year: this.number, month, day});
    }

    toJson() {
      const data = {};
      const days = this.getAllDays().filter(day => day.status != Status.Unplanned);

      for(const day of days) {
        data[day.getIsoDate()] = day.status;
      }

      return data;
    }

    reset() {
      this.getAllDays().forEach(day => day.status = Status.Unplanned);
    }

    findDay(monthNumber, dayNumber) {
      const month = app.currentYear.months[monthNumber - 1];

      return  month.days[dayNumber - 1];
    }
  }

  const app = new Vue({
    el: '#app',
    created() {
      const now = DateTime.now();
      this.currentYearNumber = now.year;
    },
    data: {
      currentYear: undefined,
      currentYearNumber: undefined,
      totalDaysAvailable: 30,
      currentStatus: undefined,
      undoStack: [],
      redoStack: [],
      years: {},
    },
    watch: {
      currentYearNumber(number) {
        if(number == undefined) {
          return;
        }

        this.updateCurrentYear();
      },
    },
    methods: {
      reset() {
        this.undoStack = [];
        this.redoStack = [];
        this.years = [];
        this.currentYearNumber = DateTime.now().year;

        if(!(this.currentYearNumber in this.years)) {
          this.currentYear = this.years[this.currentYearNumber] = new Year(this.currentYearNumber);
        }
      },
      increaseDayStatus(day) {
        const oldStatus = day.status;
        const newStatus = day.increaseStatus();
        this.currentStatus = newStatus;

        if(oldStatus != newStatus) {
          this.addUndo(
            () => {
              day.status = oldStatus;
            },
            () => {
              day.status = newStatus;
            },
          );
        }
      },
      applyCurrentStatus(day) {
        if(this.currentStatus == undefined) {
          return;
        }

        const oldStatus = day.status;
        const newStatus = day.setStatus(this.currentStatus);

        if(oldStatus != newStatus) {
          this.updateLastUndo(
            prev => {
              day.status = oldStatus;
              prev();
            },
            prev => {
              prev();
              day.status = newStatus;
            },
          );
        }
      },
      undo() {
        if(this.undoStack.length == 0) {
          return;
        }

        const action = this.undoStack.pop();
        this.redoStack.push(action);

        action[0]();

        port2.postMessage({type: 'undo', available: this.undoStack.length > 0});
        port2.postMessage({type: 'redo', available: true});
        port2.postMessage({type: 'touch'});
      },
      redo() {
        if(this.redoStack.length == 0) {
          return;
        }

        const action = this.redoStack.pop();
        this.undoStack.push(action);

        action[1]();

        port2.postMessage({type: 'undo', available: true});
        port2.postMessage({type: 'redo', available: this.redoStack.length > 0});
        port2.postMessage({type: 'touch'});
      },
      addUndo(undoCallback, redoCallback) {
        this.redoStack = [];
        this.undoStack.push([undoCallback, redoCallback]);

        port2.postMessage({type: 'undo', available: true});
        port2.postMessage({type: 'redo', available: false});
        port2.postMessage({type: 'touch'});
      },
      updateLastUndo(undoCallback, redoCallback) {
        if(this.undoStack.length > 0) {
          const action = this.undoStack[this.undoStack.length - 1];

          this.undoStack.splice(-1, 1, [
            () => {
              undoCallback(action[0]);
            },
            () => {
              redoCallback(action[1]);
            },
          ]);

          port2.postMessage({type: 'touch'});
        }
      },
      updateCurrentYear() {
        if(!(this.currentYearNumber in this.years)) {
          this.years[this.currentYearNumber] = new Year(this.currentYearNumber);
        }

        this.currentYear = this.years[this.currentYearNumber];
      },
    },
  });

  window.addEventListener('mouseup', () => app.currentStatus = undefined);

  function importFromData(data) {
    app.currentYear.reset();

    app.totalDaysAvailable = data.holidaysPerYear;
    app.currentYearNumber = data.currentYear;

    for(const [isoDate, status] of Object.entries(data.vacation)) {
      const dateTime = DateTime.fromISO(isoDate);

      if(dateTime.year != app.currentYearNumber) {
        app.currentYearNumber = dateTime.year;
        app.updateCurrentYear();
      }

      app.currentYear.findDay(dateTime.month, dateTime.day).status = status;
    }
  }

  document.body.addEventListener('dragover', event => {
    if(event.dataTransfer.types[0] != 'Files') {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });

  document.body.addEventListener('drop', event => {
    const file = event.dataTransfer.files[0];

    const reader = new FileReader();
    reader.onload = event => {
      importFromData(JSON.parse(event.target.result));
    };

    reader.readAsText(file);
  });

  if(typeof require == 'function') {
    const {ipcRenderer} = require('electron');

    port2.onmessage = event => {
      const {type, data} = event.data;

      switch(type) {
        default:
          console.warn(`unknown message type "${type}"`);
          break;
        case 'reset':
          app.reset();
          break;
        case 'undo':
          app.undo();
          break;
        case 'redo':
          app.redo();
          break;
        case 'export':
          let vacation = {};

          [...Object.values(app.years)].forEach(year => vacation = {...vacation, ...year.toJson()});

          port2.postMessage({
            data: {
              holidaysPerYear: 30,
              currentYear: app.currentYearNumber,
              vacation,
            },
          });
          break;
        case 'import': {
          importFromData(data);
          break;
        }
      }
    };

    ipcRenderer.postMessage('port', null, [port1]);
  }
})();
