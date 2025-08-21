/**
 * Parses simulation state from server response
 * @param {string} stateString - The state string from server
 * @returns {Object|null} - Parsed state object or null if parsing fails
 */
function parseSimulationState(stateString) {
  try {
    const cleanString = stateString
      .trim()
      .replace(/^\.?\{/, "")
      .replace(/}$/, "");

    const assignments = cleanString.split(",");
    const state = {};

    for (const assignment of assignments) {
      const trimmed = assignment.trim();
      const match = trimmed.match(/^\.?(\w+)\s*=\s*(-?\d*\.?\d+)/);
      if (match) {
        const [, varName, value] = match;
        state[varName] = parseFloat(value);
      }
    }

    return state;
  } catch (error) {
    console.error("Failed to parse simulation state:", error);
    return null;
  }
}

/**
 * Updates local variables with server state
 * @param {Object} serverState - Parsed server state
 */
function updateVariablesFromServer(serverState) {
  for (const variable of variables) {
    if (serverState.hasOwnProperty(variable.name)) {
      let newValue = serverState[variable.name];

      // Divide by pi for pi variables
      const angleVariables = [
        "turn_rate",
        "sample_angle",
        "turn_rate_mod",
        "sample_angle_mod",
      ];
      if (angleVariables.includes(variable.name)) {
        newValue = Math.round((newValue / Math.PI) * 10000) / 10000;
      }

      let finalValue =
        variable.type === "int" ? Math.round(newValue) : newValue;
      finalValue = clampValue(finalValue, variable.range);

      variable.value = finalValue;
      console.log(
        `Updated ${variable.name}: ${finalValue} (server sent: ${serverState[variable.name]})`,
      );
    }
  }

  m.redraw();
}

/**
 * Defines a variable that can be modified by the user and gets updates from the server
 * @typedef {Object} VariableDef
 * @property {string} name - Variable name
 * @property {string} type - Variable type
 * @property {float|int} value - On-client value
 * @property {float|int} step - Step size for increment/decrement (optional, defaults to 0.1 for float, 1 for int)
 * @property {Object} range - Min/max range (optional)
 * @property {float|int} range.min - Minimum value
 * @property {float|int} range.max - Maximum value
 */

// Variable data
const variables = [
  { name: "move_dist", type: "float", value: 0.0, step: 0.01 },
  { name: "turn_rate", type: "float", value: 0.0, step: 0.5 },
  { name: "sample_dist", type: "float", value: 0.0, step: 0.01 },
  { name: "sample_angle", type: "float", value: 0.0, step: 0.05 },
  { name: "move_dist_mod", type: "float", value: 0.0, step: 0.01 },
  { name: "turn_rate_mod", type: "float", value: 0.0, step: 0.5 },
  { name: "sample_dist_mod", type: "float", value: 0.0, step: 0.01 },
  { name: "sample_angle_mod", type: "float", value: 0.0, step: 0.05 },
  { name: "density_scale", type: "int", value: 0, step: 1 },
  {
    name: "pheromone_decay_rate",
    type: "float",
    value: 0.0,
    step: -0.5,
    range: { min: -100, max: 1 },
  },
];

/**
 * Gets the default step size for a variable type
 * @param {string} type
 * @returns {number}
 */
function getDefaultStep(type) {
  return type === "int" ? 1 : 0.1;
}

/**
 * Clamps a value to the specified range
 * @param {number} value
 * @param {Object} range
 * @returns {number}
 */
function clampValue(value, range) {
  if (!range) return value;

  let clamped = value;
  if (range.min !== undefined) clamped = Math.max(range.min, clamped);
  if (range.max !== undefined) clamped = Math.min(range.max, clamped);
  return clamped;
}

/**
 * Processes variable name for display
 * @param {string} name
 * @returns {string}
 */
function processVariableName(name) {
  var processed_name = name.split("_");
  processed_name = processed_name.map((value) => {
    var all_upper = value.toUpperCase();
    return all_upper.slice(0, 1).concat(value.slice(1));
  });
  return processed_name.join(" ");
}

const VariableComponent = {
  oninit: function (vnode) {
    this.isEditing = false;
    this.editValue = "";
  },

  view: function (vnode) {
    const variable_def = vnode.attrs.variable;
    const processed_name = processVariableName(variable_def.name);
    const step = variable_def.step || getDefaultStep(variable_def.type);

    return m(
      "div",
      {
        class:
          "mx-auto flex flex-row max-w-sm items-center gap-x-4 rounded-xl bg-1-l p-6 shadow-lg outline outline-2-l",
      },
      [
        m(
          "div",
          {
            class: "flex-col gap-y-4",
          },
          [
            m(
              "label",
              {
                class: "text-md font-medium text-2-l",
              },
              processed_name,
            ),
            m("input", {
              type: "text",
              rows: "2",
              cols: "5",
              class:
                "w-full py-2 border-2 border-3-l bg-1-l rounded-lg text-xl text-center focus:outline-none focus:ring-2 focus:ring-2-l focus:border-transparent text-5-l",
              value: this.isEditing
                ? this.editValue
                : variable_def.value.toString(),
              onfocus: (e) => {
                this.isEditing = true;
                this.editValue = variable_def.value.toString();
              },
              onblur: (e) => {
                this.applyEdit(variable_def);
              },
              oninput: (e) => {
                this.editValue = e.target.value;
              },
              onkeydown: (e) => {
                if (e.key === "Enter") {
                  this.applyEdit(variable_def);
                  e.target.blur();
                } else if (e.key === "Escape") {
                  this.isEditing = false;
                  this.editValue = "";
                  e.target.blur();
                  m.redraw();
                }
              },
            }),
          ],
        ),
        m(
          "div",
          {
            class: "flex flex-col",
          },
          [
            m(
              "button",
              {
                class:
                  "h-auto w-20 rounded-t-xl text-5-l border-2 border-3-l border-b-5-l bg-1-l hover:bg-2-l/50 active:bg-2-l",
                onclick: function () {
                  let newValue = variable_def.value + step;

                  newValue = clampValue(newValue, variable_def.range);

                  if (variable_def.type === "float") {
                    const decimals = step.toString().split(".")[1]?.length || 0;
                    newValue =
                      Math.round(newValue * Math.pow(10, decimals)) /
                      Math.pow(10, decimals);
                  }

                  variable_def.value = newValue;

                  sendVariableUpdate(variable_def.name, newValue);
                  m.redraw();
                },
              },
              "Up",
            ),
            m(
              "button",
              {
                class:
                  "h-auto w-20 rounded-b-xl text-5-l border-2 border-3-l border-t-5-l bg-1-l hover:bg-2-l/50 active:bg-2-l",
                onclick: function () {
                  let newValue = variable_def.value - step;

                  newValue = clampValue(newValue, variable_def.range);

                  if (variable_def.type === "float") {
                    const decimals = step.toString().split(".")[1]?.length || 0;
                    newValue =
                      Math.round(newValue * Math.pow(10, decimals)) /
                      Math.pow(10, decimals);
                  }

                  variable_def.value = newValue;

                  sendVariableUpdate(variable_def.name, newValue);
                  m.redraw();
                },
              },
              "Down",
            ),
          ],
        ),
      ],
    );
  },

  applyEdit: function (variable_def) {
    if (!this.isEditing) return;

    let newValue = parseFloat(this.editValue) || 0;
    if (variable_def.type === "int") {
      newValue = parseInt(this.editValue) || 0;
    }

    newValue = clampValue(newValue, variable_def.range);
    variable_def.value = newValue;

    sendVariableUpdate(variable_def.name, newValue);

    this.isEditing = false;
    this.editValue = "";

    m.redraw();
  },
};

let ws = null;
const port = 9224;

function initWebSocket() {
  ws = new RobustWebSocket(
    /* `ws://192.168.8.121:${port}`); // */ `ws://benitop.dyn.wpi.edu:${port}`,
  );

  ws.addEventListener("open", function (event) {
    console.log("WebSocket connected");
  });

  ws.addEventListener("message", function (event) {
    console.log("Received:", event.data);

    const message = event.data.trim();

    if (message.startsWith("Success: ")) {
      const stateString = message.substring(9);
      console.log("Processing simulation state:", stateString);

      const serverState = parseSimulationState(stateString);
      if (serverState) {
        updateVariablesFromServer(serverState);
        console.log("Successfully updated variables from server");
      } else {
        console.warn("Failed to parse simulation state from server");
      }
    } else {
      console.warn("Server message:", message);
    }
  });

  ws.addEventListener("error", function (event) {
    console.error("WebSocket error:", event);
  });

  ws.addEventListener("close", function (event) {
    console.log("WebSocket closed");
  });
}

/**
 * Sends variable update to server
 * @param {string} variableName
 * @param {number} value
 */
function sendVariableUpdate(variableName, value) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("WebSocket not connected");
    return;
  }

  let baseName = variableName;
  let hasMod = false;

  if (variableName.endsWith("_mod")) {
    baseName = variableName.slice(0, -4); // Remove "_mod"
    hasMod = true;
  }

  let message = `${baseName} ${value}`;
  if (hasMod) {
    message += " mod";
  }

  console.log("Sending:", message);
  ws.send(message);
}

const App = {
  oninit: function (vnode) {
    this.variables = variables;

    initWebSocket();
  },

  view: function (vnode) {
    return m(
      "div",
      {
        class:
          "min-h-screen size-full flex flex-col items-center bg-[repeating-linear-gradient(-45deg,_var(--pattern-fg)_0,_var(--pattern-fg)_4px,_transparent_6px,_transparent_20px,_var(--pattern-fg)_22px)] bg-fixed",
      },
      [
        m(
          "div",
          {
            class:
              "sm:grid sm:grid-cols-3 flex flex-col sm:p-8 sm:gap-x-4 p-8 gap-y-4",
            id: "box_store",
          },
          this.variables.map((variable) =>
            m(VariableComponent, {
              key: variable.name, // Important for proper diffing
              variable: variable,
            }),
          ),
        ),
      ],
    );
  },
};

document.body.className = "bg-1-l [--pattern-fg:_var(--color-2-l)]/75";
m.mount(document.body, App);
