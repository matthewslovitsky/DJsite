// --- Analog Inputs ---
const int potmeter = A2;
const int left = A0;
const int right = A1;

int lastPotValue = -1;
int lastLeftValue = -1;
int lastRightValue = -1;
const int analogThreshold = 4;

// --- Rotary Encoder R ---
const int volR_CLK = 2;
const int volR_DT  = 3;
int volRValue = 0;
int lastCLK_R = HIGH;

// --- Rotary Encoder L ---
const int volL_CLK = 4;
const int volL_DT  = 5;
int volLValue = 0;
int lastCLK_L = HIGH;

void setup() {
  // Analog inputs
  pinMode(potmeter, INPUT);
  pinMode(left, INPUT);
  pinMode(right, INPUT);

  // Encoders
  pinMode(volR_CLK, INPUT_PULLUP);
  pinMode(volR_DT, INPUT_PULLUP);

  pinMode(volL_CLK, INPUT_PULLUP);
  pinMode(volL_DT, INPUT_PULLUP);

  Serial.begin(9600);
  Serial.println("Arduino started");
}

void loop() {
  bool changed = false;

  // --- Read Analog Inputs ---
  int potValue = analogRead(potmeter);
  int leftValue = analogRead(left);
  int rightValue = analogRead(right);

  if (abs(potValue - lastPotValue) > analogThreshold) {
    lastPotValue = potValue;
    changed = true;
  }
  if (abs(leftValue - lastLeftValue) > analogThreshold) {
    lastLeftValue = leftValue;
    changed = true;
  }
  if (abs(rightValue - lastRightValue) > analogThreshold) {
    lastRightValue = rightValue;
    changed = true;
  }

  // --- Read Encoder R (pins 2 & 3) ---
  int clkR = digitalRead(volR_CLK);
  if (lastCLK_R == HIGH && clkR == LOW) {
    int dtR = digitalRead(volR_DT);
    volRValue += (dtR == HIGH) ? 10 : -10;
    volRValue = constrain(volRValue, 0, 100);
    changed = true;
  }
  lastCLK_R = clkR;

  // --- Read Encoder L (pins 4 & 5) ---
  int clkL = digitalRead(volL_CLK);
  if (lastCLK_L == HIGH && clkL == LOW) {
    int dtL = digitalRead(volL_DT);
    volLValue += (dtL == HIGH) ? 10 : -10;
    volLValue = constrain(volLValue, 0, 100);
    changed = true;
  }
  lastCLK_L = clkL;

  // --- Print Output if Any Changed ---
  if (changed) {
    Serial.print("Potmeter:");
    Serial.print(potValue);
    Serial.print(" | Left:");
    Serial.print(leftValue);
    Serial.print(" | Right:");
    Serial.print(rightValue);
    Serial.print(" | FadeL:");
    Serial.print(volRValue);
    Serial.print(" | FadeR:");
    Serial.println(volLValue);
  }

  delay(1); // debounce & smooth polling
}