# RAKSHA-SETU
THE PROMBLEM :
               Every minute counts after a high-impact collision.
               Current system often fail due to:
               1 Connectivity Gaps : No celluar signal in remote areas.
               2 false alarms : sensors triggering on potholes or phone drops.
               3 Informatioin Vaccuum : First responders lack the driver's medical history upon arrival.


               Our Solution 
               Raksha-Setu utilizes a " Tri-Path"communication strategy and an AI-filter to ensure 100% reliability and zero false dispatches.

               Key Features
               . AI Sensor Fusion: Uses a lightweight Machine Learning model to distinguish between a genuine crash and a sensor malfunction or minor bump.
               . The 30-second grace window : Upon impact detection, a countdown begins on the driver's phone/dashboard.If it's a false alarm,
               the driver can cancel it manually.
               .LoRaWAN Integration: In areas without 4g/5g, the system broadcasts data via long range (LoRa) gateways up to 15km away
               .SmS Fallback: If data services are offline,the system sends a structured medical data sms.
               .Government-Ready Directory: integrated helpline database include Highway (1033),Railway (1072) and Poison Control.
               System Architecture 

               1. Detection Phase (Edge AI}

                The onboard IMU (inertial Measurement Unit) tracks G-force. The AI model calculates the probability of a crash (pc) based on
                pc= impact force + Rotational delta/ viberation noise index.

                If Pc exceed the safety thershold,the alert sequence intiates.

                2. communication phase (multi-tier)

                    Priority             channel                target                           content  
                      
                     1                     wifi/cellular        cloud API/ Hospital server              full Telemetry + map
                      2                    LoRaWAN                 Local gateway                    Gps + medical info
                     3                      SMS/GSM               Emergency Contacts                 Text Alert + location link

                                          
               3. Medical Data Packet 
                 To assist paramedics,the system transmits a compressed Driver Medical Profile:
                 . Blood Group:(eg o-negative)
                 .Allergies:(eg.penicillin)
                 * chronic Condition( e.g., Diabetic/Asthmatic)
                 * Emergency contact: instant "One-Tap" call button for responders.

                  Project structure

                       ├── Hardware/            # PCB Designs & Wiring Diagrams
                       ├── Firmware/            # ESP32/Arduino code for LoRa & Sensors
                       ├── AI_Model/            # TensorFlow Lite model for crash detection
                       ├── Mobile_App/          # Flutter/React Native source for the Gov-App
                       └── Server/              # Backend for Hospital & Police registration


                      Hardware Requirements
​                      Controller: ESP32 or Arduino Nano IoT.
​                      Sensors: MPU6050 (Accelerometer/Gyroscope).
​                      Connectivity: Semtech SX1276 (LoRa) & SIM800L (GSM).
​                      Interface: OLED Display & Buzzer for the "Cancel Alert" prompt.
 
                  ​📈 Vision: The "National Safety App"
​                     We aim to integrate this into a centralized Government Dashboard.
​                     Hospitals: Register their fleet to receive "Pre-Arrival" patient data.
                     ​Citizens: One-click access to helplines they didn't know existed (e.g., Highway Patrol 1033).
​                     Police: Real-time heatmaps of accident-prone zones.


           AUTHOR : YASHVARDHAN SINGH RATHORE

                                                                           
