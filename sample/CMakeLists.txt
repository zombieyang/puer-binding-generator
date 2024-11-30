cmake_minimum_required(VERSION 3.12)
project(MyProject)

# Add your source files here
set(SOURCES
    src/main.cpp
)

# Add your header files here
set(HEADERS
    src/main.h
)

# Create the executable
add_executable(MyProject ${SOURCES} ${HEADERS})
