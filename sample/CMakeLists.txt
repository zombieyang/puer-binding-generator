cmake_minimum_required(VERSION 3.12)
project(MyProject)

# Set C++ standard to C++14
set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

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
